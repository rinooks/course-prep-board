"use client";

// 로그인 상태와 "초대받은 팀원인지"를 앱 전체에 알려 준다.
// 흐름: 구글 로그인 → members/{이메일} 문서 확인
//   있음 → 팀원 (프로필 갱신) / 없음 + 첫 관리자 이메일 → 관리자 문서 생성 / 없음 → 초대 필요

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { createBootstrapAdmin, linkMemberProfile, subscribeOwnMember } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";
import { isBootstrapAdmin } from "@/lib/domain/roles";
import { normalizeEmail } from "@/lib/domain/validation";

export type AuthStatus = "loading" | "signedOut" | "notInvited" | "member" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  /** Firebase 로그인 사용자 (로그인 안 했으면 null) */
  user: User | null;
  /** 내 소문자 이메일 (로그인 안 했으면 null) */
  email: string | null;
  /** 내 팀원 문서 (status가 member일 때만) */
  member: Member | null;
  /** 관리자 여부 (보안 규칙과 같은 기준: role이 admin이거나 첫 관리자 이메일) */
  isAdmin: boolean;
  /** 사용자에게 보여줄 문구. 로그인 실패·연결 오류 때 들어온다 */
  error: string | null;
  /** 로그인 창이 떠 있는 동안 true */
  signingIn: boolean;
  /** 구글 로그인 창 열기. 실패해도 throw하지 않고 error에 문구를 넣는다 */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** status가 error일 때 다시 확인 */
  retry: () => void;
  /** error 문구 지우기 */
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED_MESSAGE =
  "앱 설정값(Firebase)이 비어 있어 로그인할 수 없습니다. 관리자에게 배포 설정을 확인해 달라고 알려 주세요.";
const UNVERIFIED_MESSAGE =
  "이메일 인증이 끝나지 않은 계정입니다. 구글 계정으로 로그아웃한 뒤 다시 로그인해 주세요.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 로그인 세션마다 프로필 갱신·첫 관리자 생성을 한 번만 하려고 기억한다
  const profileLinkedFor = useRef<string | null>(null);
  const bootstrapTriedFor = useRef<string | null>(null);
  const currentUid = useRef<string | null>(null);

  // 1) 로그인 상태 구독
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // 설정이 없으면 Firebase를 만들 수 없다. 외부 상태를 화면 상태로 옮기는 것이므로 여기서 설정한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        getFirebaseAuth(),
        (nextUser) => {
          const nextUid = nextUser?.uid ?? null;
          // 같은 사람이면(다시 시도 등) 팀원 구독 결과를 지우지 않는다
          if (nextUid === currentUid.current && nextUser) return;
          currentUid.current = nextUid;
          setUser(nextUser);
          setMember(null);
          if (!nextUser) {
            profileLinkedFor.current = null;
            bootstrapTriedFor.current = null;
            setStatus("signedOut");
          } else {
            setStatus("loading");
          }
        },
        (authError) => {
          setStatus("error");
          setError(toUserMessage(authError));
        },
      );
    } catch (caught) {
      setStatus("error");
      setError(toUserMessage(caught));
    }
    return () => unsubscribe();
  }, [attempt]);

  // 2) 로그인했으면 내 팀원 문서 구독 (초대 취소·역할 변경이 바로 반영된다)
  useEffect(() => {
    if (!user) return;
    if (!user.email || !user.emailVerified) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError(UNVERIFIED_MESSAGE);
      return;
    }
    const email = normalizeEmail(user.email);

    const unsubscribe = subscribeOwnMember(
      email,
      (memberDoc) => {
        // 서버가 확인한 결과가 왔으므로 앞서 띄운 연결 오류 문구는 지운다
        setError(null);
        if (memberDoc) {
          setMember(memberDoc);
          setStatus("member");
          if (profileLinkedFor.current !== user.uid) {
            profileLinkedFor.current = user.uid;
            // 프로필 갱신이 실패해도 앱 사용에는 지장이 없어 기록만 남긴다
            linkMemberProfile(user).catch((linkError: unknown) => {
              console.warn("프로필 갱신 실패", linkError);
            });
          }
          return;
        }

        setMember(null);
        if (isBootstrapAdmin(email) && bootstrapTriedFor.current !== user.uid) {
          bootstrapTriedFor.current = user.uid;
          setStatus("loading");
          createBootstrapAdmin(user).catch((createError: unknown) => {
            setStatus("error");
            setError(toUserMessage(createError));
          });
          return;
        }
        setStatus("notInvited");
      },
      (memberError) => {
        setStatus("error");
        setError(toUserMessage(memberError));
      },
    );
    return () => unsubscribe();
  }, [user, attempt]);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setError(NOT_CONFIGURED_MESSAGE);
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getFirebaseAuth(), provider);
    } catch (signInError) {
      // 사용자가 창을 닫은 경우도 안내 문구를 보여주고, 상태는 로그아웃 그대로 둔다
      setError(toUserMessage(signInError));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getFirebaseAuth());
      setError(null);
    } catch (signOutError) {
      setError(toUserMessage(signOutError, "로그아웃하지 못했습니다. 페이지를 새로고침한 뒤 다시 눌러 주세요."));
    }
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setStatus("loading");
    profileLinkedFor.current = null;
    bootstrapTriedFor.current = null;
    setAttempt((value) => value + 1);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const email = user?.email ? normalizeEmail(user.email) : null;
  const isAdmin = status === "member" && (member?.role === "admin" || isBootstrapAdmin(email));

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      email,
      member: status === "member" ? member : null,
      isAdmin,
      error,
      signingIn,
      signIn,
      signOut,
      retry,
      clearError,
    }),
    [status, user, email, member, isAdmin, error, signingIn, signIn, signOut, retry, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다 (app/layout.tsx 확인).");
  }
  return value;
}
