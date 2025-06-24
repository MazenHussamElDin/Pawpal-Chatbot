document.addEventListener("DOMContentLoaded", () => {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");
    const icon = item.querySelector(".toggle-icon");

    question.addEventListener("click", () => {
      const isVisible = answer.classList.contains("show");

      faqItems.forEach(i => {
        i.querySelector(".faq-answer").classList.remove("show");
        i.querySelector(".toggle-icon").textContent = "+";
      });

      if (!isVisible) {
        answer.classList.add("show");
        icon.textContent = "–";
      } else {
        answer.classList.remove("show");
        icon.textContent = "+";
      }
    });
  });
});




// for login page


const showLoginBtn = document.getElementById("show-login");
const showSignupBtn = document.getElementById("show-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

showLoginBtn.onclick = () => {
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showSignupBtn.classList.remove("active");
};

showSignupBtn.onclick = () => {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  showLoginBtn.classList.remove("active");
  showSignupBtn.classList.add("active");
};
  