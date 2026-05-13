
# 네이버 자동입력 로컬 서버 버전

## 최초 설치

```bash
npm install
npm run install-browser
```

## 1단계: 로컬 서버 실행

```bash
npm run server
```

실행되면:

```text
로컬 서버 실행중: http://localhost:3333
```

출력됨

## 2단계: 웹앱에서 전송

웹앱에서:

```text
AI 초안 생성
→ 네이버 HTML 생성
→ 자동입력으로 보내기
```

클릭

## 3단계: 자동입력 실행

새 cmd 창 열고:

```bash
npm start
```

## 자동화 기능

- 제목 입력
- 대표 이미지 업로드
- 본문 사진 업로드
- 본문 HTML 붙여넣기
- 저장 버튼 자동 클릭

저장 버튼 선택자:

```html
<button type="button" class="save_btn__bzc5B" data-click-area="tpb.save">
```
