// 직원 기본 화면과 개발용 진단 화면의 표시만 전환한다. 권한이나 API 기능을 바꾸지 않는다.
const button = document.getElementById('tech-view-toggle');
if (button) {
  button.addEventListener('click', () => {
    const showing = document.body.classList.toggle('show-tech');
    button.setAttribute('aria-pressed', String(showing));
    button.textContent = showing ? '직원 화면으로 돌아가기' : '진단·실습 화면 보기';
  });
}
