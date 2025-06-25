// server.js

const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const knex = require('knex');
const Bot = require('./pawpal');

/*
// === MySQL Connection ===
const db = knex({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    user: 'myappuser',
    password: 'Hebahoss*1',
    database: 'myappdb'
  }
});

*/

// DB to connect to IONOS
const db = knex({
  client: 'pg',
  connection: {
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.jjzuanmfdxcabyidxxqw',
    password: 'Hebahoss*1',   // Replace this
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  }
});



db.raw('SELECT 1')
  .then(() => console.log('MySQL connected!'))
  .catch(err => console.error('Connection failed:', err));


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const myBot = new Bot(wss);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
  const { username, email, password, ownerType, dogSize, dogBreed } = req.body;

  if (!username || !email || !password || !ownerType || !dogSize || !dogBreed) {
    return res.status(400).send('Alle Felder sind erforderlich');
  }

  try {
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(409).send('E-Mail bereits registriert');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db('users').insert({ username, email, password: hashedPassword, ownerType, dogSize, dogBreed });

    res.status(201).send('Registrierung erfolgreich');
  } catch (err) {
    console.error('Registrierungsfehler:', err);
    res.status(500).send('Serverfehler');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('E-Mail und Passwort erforderlich');
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).send('Benutzer nicht gefunden');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send('Falsches Passwort');

    res.send('Login erfolgreich');
  } catch (err) {
    console.error('Login Fehler:', err);
    res.status(500).send('Serverfehler');
  }
});

//WebSocket Handling
myBot.connect();
const connections = new Map();

wss.on('connection', (ws) => {
  let userName = null;

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.warn('Ungültiges JSON empfangen:', message);
      return;
    }

    switch (data.type) {
      case 'join':
        userName = data.name;
        ws.userId = userName; 
        connections.set(userName, ws);

        try {
          const user = await db('users')
            .select('username', 'ownerType', 'dogSize', 'dogBreed')
            .where({ email: userName })
            .first();

          if (user) {
            ws.userData = user;

            myBot.sessions.set(userName, {
              ownerType: user.ownerType,
              userName: user.username
            });

          } else {
            // Guest user
            myBot.sessions.set(userName, { ownerType: null, userName: userName });
          }

          const greetMsg = myBot.generateGreeting(userName, myBot.sessions.get(userName));
          ws.send(JSON.stringify({ type: 'msg', name: 'PawPal', msg: greetMsg }));

        } catch (err) {
          console.error('Fehler beim Laden der Benutzerdaten:', err);
        }
        break;

      case 'msg':
        if (!userName) {
          console.warn('Nachricht von unbekanntem Benutzer');
          return;
        }
        myBot.post(userName, data.msg);
        break;

      case 'leave':
        if (userName && connections.has(userName)) {
          connections.delete(userName);
          broadcastAll(JSON.stringify({ type: 'join', names: Array.from(connections.keys()) }));
        }
        break;

      default:
        console.warn('Unbekannter Nachrichtentyp:', data.type);
    }
  });

  ws.on('close', () => {
    if (userName && connections.has(userName)) {
      connections.delete(userName);
      broadcastAll(JSON.stringify({ type: 'join', names: Array.from(connections.keys()) }));
    }
  });
});

function broadcastAll(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/*const HTTP_PORT = process.env.PORT || 8081;
const WS_PORT = 8181;

app.listen(HTTP_PORT, () => {
  console.log(`HTTP Server läuft auf http://localhost:${HTTP_PORT}`);
});

server.listen(WS_PORT, () => {
  console.log(`WebSocket Server läuft auf ws://localhost:${WS_PORT}`);
});*/
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`HTTP + WebSocket Server läuft auf http://localhost:${PORT}`);
});

