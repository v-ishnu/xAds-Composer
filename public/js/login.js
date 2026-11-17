const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.querySelector(".login-btn");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginMessage.textContent = "";
  loginMessage.style.color = "";

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  try {
    const response = await axios.post("/api/auth/login", {
      email,
      password,
    });

    loginMessage.textContent = "Login successful! Redirecting...";
    loginMessage.style.color = "#00ba7c";

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600);
  } catch (error) {
    console.error("Login error:", error);
    loginMessage.style.color = "#f4212e";

    if (error.response && error.response.data) {
      loginMessage.textContent =
        error.response.data.error ||
        error.response.data.message ||
        "Invalid login credentials.";
    } else {
      loginMessage.textContent =
        "Network or server error. Please try again.";
    }
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log in";
  }
});
