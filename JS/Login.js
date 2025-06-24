$(document).ready(function () {

  //Registration Form logic
  $('#registerForm').on('submit', function (e) {
    e.preventDefault();

    const formData = {
      username: $('#register-username').val().trim(),
      email: $('#register-email').val().trim(),
      password: $('#register-password').val().trim(),
      ownerType: $('#register-ownerType').val(),
      dogSize: $('#register-dogSize').val(),
      dogBreed: $('#register-dogBreed').val()
    };

    $.ajax({
      url: 'http://localhost:8081/register',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        localStorage.setItem('userEmail', formData.email);
        window.location.href = "/chat.html";
      },
      error: function (xhr) {
        if (xhr.status === 409) {
          alert("E-Mail bereits registriert!");
        } else {
          alert("Fehler bei der Registrierung.");
        }
      }
    });
  });

  //Login Form logic
  $('#loginForm').on('submit', function (e) {
    e.preventDefault();

    const loginData = {
      email: $('#login-email').val().trim(),
      password: $('#login-password').val().trim()
    };

    $.ajax({
      url: 'http://localhost:8081/login',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(loginData),
      success: function (res) {
        localStorage.setItem('userEmail', loginData.email);
        window.location.href = "/chat.html";
      },
      error: function (xhr) {
        if (xhr.status === 401) {
          alert("Falsches Passwort.");
        } else if (xhr.status === 400) {
          alert("Benutzer nicht gefunden.");
        } else {
          alert("Fehler beim Login.");
        }
      }
    });
  });

});
