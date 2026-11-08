// 재료(materials) 읽기·쓰기 (PRD F4). 파일 저장소 없이 글·받아쓰기·링크만 Firestore에 둔다.
// 지우기는 휴지통 표시(deletedAt)로만 한다. 완전 삭제는 규칙에서 막혀 있다.

import { serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createId } from "@/lib/domain/ids";
import { validateMaterialInput, validateMaterialPatch } from "@/lib/domain/validation";
import type { MaterialKind } from "@/lib/domain/materials";
import { courseChildCol, courseChildDoc } from "./refs";
import { toMaterial } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  CreateOptions,
  ErrorHandler,
  Material,
  MaterialInput,
  MaterialUpdateInput,
  Unsubscribe,
} from "./types";

/** 과정의 재료 구독 (휴지통 포함). 걸러 보기는 filterMaterials로 한다 */
export function subscribeMaterials(
  courseId: string,
  onData: (materials: Material[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => courseChildCol(courseId, "materials"),
    (snapshot) => toMaterial(courseId, snapshot),
    onData,
    onError,
  );
}

/** 재료 추가. 같은 options.id로 다시 부르면 두 번 만들지 않는다. 돌려주는 값: 재료 id */
export async function createMaterial(
  courseId: string,
  input: MaterialInput,
  options: CreateOptions = {},
): Promise<string> {
  const check = validateMaterialInput({
    kind: input.kind,
    title: input.title,
    body: input.body ?? "",
    url: input.url ?? "",
    stage: input.stage ?? null,
    memo: input.memo ?? "",
    excludeFromAi: input.excludeFromAi ?? false,
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const materialId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(courseChildDoc(courseId, "materials", materialId), {
        ...check.value,
        deletedAt: null,
        deletedBy: null,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `material:create:${courseId}:${materialId}`,
  );
  return materialId;
}

/** 재료 고치기. 종류는 바꿀 수 없다. 바꿀 칸만 넣는다 */
export async function updateMaterial(
  courseId: string,
  materialId: string,
  kind: MaterialKind,
  patch: MaterialUpdateInput,
): Promise<void> {
  const check = validateMaterialPatch(kind, patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "materials", materialId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 휴지통으로 */
export async function trashMaterial(courseId: string, materialId: string): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "materials", materialId), {
      deletedAt: serverTimestamp(),
      deletedBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 휴지통에서 되살리기 */
export async function restoreMaterial(courseId: string, materialId: string): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "materials", materialId), {
      deletedAt: null,
      deletedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}
