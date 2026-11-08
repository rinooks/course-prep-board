// 경로 조각 배열로 문서·컬렉션 참조를 만든다 (표 형태 테스트용)

import { collection, doc, type CollectionReference, type DocumentReference, type Firestore } from "firebase/firestore";

export type PathSegments = readonly [string, ...string[]];

export function docAt(db: Firestore, segments: PathSegments): DocumentReference {
  const [first, ...rest] = segments;
  return doc(db, first, ...rest);
}

export function collectionAt(db: Firestore, segments: PathSegments): CollectionReference {
  const [first, ...rest] = segments;
  return collection(db, first, ...rest);
}
