# 네이버 블로그 자동입력 3-2

## 사용 순서

### 1. 웹앱에서 준비

1. AI 초안 생성
2. 네이버 HTML 생성
3. 네이버 자동입력용 JSON 다운로드
4. 다운로드된 `naver-post.json`을 이 폴더에 넣기

### 2. 설치

터미널에서 이 폴더로 이동:

```bash
cd naver-automation
npm install
npm run install-browser
```

### 3. 실행

```bash
npm start
```

또는 JSON 경로를 직접 지정:

```bash
node naver-auto-fill.js ./naver-post.json
```

## 동작

- 크롬 브라우저 열림
- 네이버 로그인은 직접
- 글쓰기 화면에서 Enter
- 제목 자동 입력
- 사진 업로드 시도
- 본문 HTML 붙여넣기
- 임시저장 시도

## 주의

네이버 스마트에디터 구조가 자주 바뀌어서 모든 버튼 클릭이 100% 자동으로 되지는 않을 수 있습니다.  
첫 버전은 반자동 구조이며, 실패 시 사용자가 해당 위치를 직접 클릭한 뒤 Enter를 누르는 방식으로 진행합니다.
