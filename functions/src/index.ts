// 강의 준비 보드 서버 함수 모음. Firebase에 따로 배포한다 (Vercel과 무관):
//   firebase deploy --only functions --project edu-project-f1d12 --account owner@example.com
// 함수마다 파일 하나에 둔다.

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { onLectureUploaded } from "./onLectureUploaded";
