$(document).ready(function () {
  // WebSocket connection to backend server
  const socket = new WebSocket('ws://127.0.0.1:8181/', 'chat');

  // Load user from localStorage (if logged-in)
  let userEmail = localStorage.getItem('userEmail');
  let userName = userEmail || "Gast" + Math.floor(Math.random() * 1000);

  socket.onopen = function () {
    socket.send(JSON.stringify({ type: "join", name: userName }));
    appendSystemMessage(`🟢 Verbunden als ${userName}`);
  };

  // Send 
  $('#sendBtn').on('click', function (e) {
    e.preventDefault();
    const msg = $('#msg').val().trim();
    if (msg.length === 0) return;

    socket.send(JSON.stringify({ type: "msg", msg: msg, sender: userName }));
    appendUserMessage(msg);
    $('#msg').val('').focus();
  });

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'msg':
        if (data.name !== userName) {
          if (data.name === 'PawPal') {
            appendBotMessage(data.msg);
          } else {
            appendOtherUserMessage(data.name, data.msg);
          }
        }
        break;

      case 'join':
        updateUsersList(data.names);
        break;

      default:
        console.warn('Unbekannter Nachrichtentyp:', data.type);
    }
  };

  // Message appending 
  function appendUserMessage(message) {
    const msgDiv = $('<div class="chat-message user-message"></div>').text(message);
    $('#msgs').append(msgDiv);
    scrollChatToBottom();
  }

  function appendOtherUserMessage(sender, message) {
    const msgDiv = $('<div class="chat-message other-user-message"></div>')
      .html(`<strong>${sender}:</strong> ${escapeHtml(message)}`);
    $('#msgs').append(msgDiv);
    scrollChatToBottom();
  }

  function appendBotMessage(message) {
    const msgDiv = $('<div class="chat-message bot-message"></div>');

    if (message.includes("<img")) {
      msgDiv.html(`<strong>PawPal:</strong> ${message}`);
    } else {
      msgDiv.html(`<strong>PawPal:</strong> ${escapeHtml(message)}`);
    }

    $('#msgs').append(msgDiv);
    scrollChatToBottom();
  }


  function appendSystemMessage(message) {
    const msgDiv = $('<div class="chat-message system-message"></div>').text(message);
    $('#msgs').append(msgDiv);
    scrollChatToBottom();
  }

  function updateUsersList(names) {
    $('#users').empty();
    names.forEach(name => {
      const userDiv = $('<div></div>').text(name);
      if (name === userName) userDiv.addClass('current-user');
      $('#users').append(userDiv);
    });
  }

  function scrollChatToBottom() {
    const chatContainer = $('#msgs');
    chatContainer.scrollTop(chatContainer.prop("scrollHeight"));
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (match) {
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escapeMap[match];
    });
  }

  // Logout buttoonn
  $('#logoutBtn').on('click', function () {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "leave", name: userName }));
      socket.close();
    }
    localStorage.removeItem('userEmail');
    window.location.reload();
  });
});
