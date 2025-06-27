const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

class Bot {
  constructor(wss) {
    
    const symptomFile = path.join(__dirname, 'symptomData.json');
    try {
      this.symptomData = JSON.parse(fs.readFileSync(symptomFile, 'utf-8'));
    } catch (err) {
      this.symptomData = { mildSymptoms: [], seriousSymptoms: [] };
    }
    
    this.wss = wss;
    this.sessions = new Map();
    this.knowledgeBase = this.loadKnowledgeBase();
    this.fallbacks = this.loadFallbacks();
    this.foodData = JSON.parse(fs.readFileSync(path.join(__dirname, 'foodSafety.json'), 'utf-8'));
  }

  //Load knowledge base JSON
  loadKnowledgeBase() {
    const file = path.join(__dirname, 'dogHelpData.json');
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
      return [];
    }
  }

  //  Load fallback answers from JSON
  loadFallbacks() {
    const file = path.join(__dirname, 'fallBackAnswers.json');
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
      return [
        "Hmm... des hob i ned verstanden."
      ];
    }
  }

  getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Create session if doesnt exists
  initializeSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        ownerType: null,
        userName: userId,
        chatHistory: []
      });
    }
  }

  // Detect owner type from user input 
  detectOwnerType(msg) {
    const lowered = msg.toLowerCase();

    if (lowered.includes("gast") || lowered.includes("guest")) return "guest";
    if (["neu", "anfänger", "ersthund", "neuer besitzer"].some(w => lowered.includes(w))) return "new";
    if (["erfahren", "alt", "langjährig", "besitzer seit jahren"].some(w => lowered.includes(w))) return "experienced";

    return null;
  }

  // Generate greeting fully from JSON file
  generateGreeting(userId, session) {
    const greetingTopic = this.knowledgeBase.find(t => t.topic === "begrüßung");
    if (!greetingTopic) {
      return `Hallo ${session.userName}!`;
    }

    const ownerType = session.ownerType || "guest";
    const greetingsForType = greetingTopic.answers[ownerType];

    if (!greetingsForType || greetingsForType.length === 0) {
      return `Hallo ${session.userName}!`;
    }

    const greeting = this.getRandom(greetingsForType);
    return greeting.replace("${userName}", session.userName);
  }

  async processMessage(userId, msg) {
    this.initializeSession(userId);
    const session = this.sessions.get(userId);
    session.ownerPromptCount ??= 0;
    const loweredMsg = msg.toLowerCase();
    const { searchBreedInfo, getBreedImage } = require('./dogApi');
    const allSymptoms = [...this.symptomData.mildSymptoms, ...this.symptomData.seriousSymptoms];
    const negationWords = ["nicht", "kein", "keine", "nein"];



    // Detect multiple questions and process separately
    const questionSplits = loweredMsg.split(/(?:\?|\bund\b|\&|\.)/g).map(q => q.trim()).filter(q => q.length > 3);

    if (questionSplits.length > 1) {
      console.log("Multiple questions detected:", questionSplits); // DEBUG LOG

      const results = [];
      for (const partial of questionSplits) {
        const answer = await this.processMessage(userId, partial);
        if (answer && !results.includes(answer)) {
          results.push(`📌 "${partial}":\n${answer}`);
        }

        // Reset any flow-specific flags
        session.expectingSymptoms = false;
        session.expectingParasites = false;
        session.expectingBehavior = false;
      }

      return "Du hast mehrere Fragen gestellt - hier sind meine Antworten:\n\n" + results.join("\n\n");
    }



    // GRATTUDE DETECTION 
    if (["danke", "dankeschön", "vielen dank"].some(w => loweredMsg.includes(w))) {
      session.goodbyeSent = true;
      return "Bis bald, war mir a Freude 🎉";
    }

    if (["tschüss", "ciao", "auf wiedersehen", "bye", "bis bald"].some(w => loweredMsg.includes(w))) {
      if (!session.goodbyeSent) {
        session.goodbyeSent = true;
        return "Pfiat di und streichel deinen Wauzi von mir! 🐕";
      } else {
        return "Mach’s guad! 👋";
      }
    }

    // GREETING DETECTION  (ALWAYS CHECK FIRST!!!!)
    const greetings = this.symptomData.greetings || [];
    if (greetings.some(g => new RegExp(`\\b${g}\\b`, 'i').test(loweredMsg))) {
      if (!session.hasGreeted) {
        session.hasGreeted = true;
        return `Hallo ${session.userName || "Hundeliebhaber"}! 🐶 Wie kann ich dir heute helfen?`;
      } else {
        return `Immer nett, dich wieder zu sehen! Was liegt an, ${session.userName || "Freund"}?`;
      }
    }


    const entryTriggers = this.symptomData.entryTriggers || [];
    const triggeredSymptomFlow = entryTriggers.some(t => loweredMsg.includes(t));

    if (triggeredSymptomFlow || session.expectingSymptoms) {
      if (!session.expectingSymptoms) {
        session.expectingSymptoms = true;
        session.symptomSuggestions = this.symptomData.seriousSymptoms.slice(0, 2);
        return "Ohje, dein Hund ist krank? 😟 Hat er Symptome wie " + session.symptomSuggestions.join(" oder ") + "?";
      }

      const negated = allSymptoms.find(symptom =>
        negationWords.some(neg =>
        new RegExp(`\\b${neg}\\b[^.?!]*\\b${symptom}\\b`, 'i').test(loweredMsg)
        )
      );

      if (negated) {
        return `Okay, kein ${negated}. Hat er vielleicht andere Symptome wie ${this.symptomData.mildSymptoms.join(", ")}?`;
      }


      const confirmed = allSymptoms.find(symptom =>
        loweredMsg.includes(symptom)
      );

      if (confirmed) {
        const serious = this.symptomData.seriousSymptoms.includes(confirmed);
        session.expectingSymptoms = false; // END flow
        return serious
          ? `${confirmed.charAt(0).toUpperCase() + confirmed.slice(1)} klingt ernst. 🏥 Geh bitte schnell zur Tierarztpraxis!`
          : `${confirmed.charAt(0).toUpperCase() + confirmed.slice(1)} ist meist harmlos. Ruhige Umgebung, Wasser bereitstellen, und beobachten. 🐾`;
      }


      return "Ich verstehe noch nicht genau. Welche Symptome zeigt dein Hund? Zum Beispiel: " + allSymptoms.join(", ");
  }


  // === SYMPTOM DETECTION ===
  for (const symptom of allSymptoms) {
    // Skip if negated
    const negated = negationWords.some(neg =>
      new RegExp(`\\b${neg}\\b[^.?!]*\\b${symptom}\\b`, 'i').test(loweredMsg)
    );
    if (negated) {
      return `Okay, kein ${symptom}. Hat er vielleicht andere Symptome wie ${this.symptomData.mildSymptoms.join(", ")}?`;
    }

    if (loweredMsg.includes(symptom)) {
      const serious = this.symptomData.seriousSymptoms.includes(symptom);
      return serious
        ? `${symptom.charAt(0).toUpperCase() + symptom.slice(1)} klingt ernst. 🏥 Geh bitte schnell zur Tierarztpraxis!`
        : `${symptom.charAt(0).toUpperCase() + symptom.slice(1)} ist meist harmlos. Ruhige Umgebung, Wasser bereitstellen, und beobachten. 🐾`;
    }
  }


  


  // === FOOD SAFETY DETECTION ===
  const foodSafe = this.foodData.safe.find(item => loweredMsg.includes(item));
  if (foodSafe) {
    return `${foodSafe.charAt(0).toUpperCase() + foodSafe.slice(1)} ist für Hunde unbedenklich ✅`;
  }

  const foodDanger = this.foodData.dangerous.find(item => loweredMsg.includes(item));
  if (foodDanger) {
    return `⚠️ ${foodDanger.charAt(0).toUpperCase() + foodDanger.slice(1)} ist gefährlich für Hunde! Bitte nicht geben.`;
  }

  const foodEntryTriggers = this.foodData.entryTriggers || [];
  if (foodEntryTriggers.some(trigger => loweredMsg.includes(trigger))) {
    return "Was hat dein Hund genau gegessen? Ich sag dir, ob's sicher ist oder ned! 🍽️";
  }


  if (loweredMsg.includes("darf mein hund") || loweredMsg.includes("kann mein hund")) {
    return `Das ist eine gute Frage. Könntest du mir sagen, welches Futter du meinst?`;
  }


  const parasiteTriggers = this.symptomData.parasiteTriggers || [];

  if (parasiteTriggers.some(trigger => loweredMsg.includes(trigger))) {
      session.expectingParasites = true;
    return "Klingt nach Ungeziefer! Hat dein Hund Flöhe, Zecken oder ähnliches? 🕷️";
  }

  if (session.expectingParasites) {
  const parasiteKeywords = ["flöhe", "zecken", "ungeziefer", "läuse", "milben"];
  const mentioned = parasiteKeywords.find(p => loweredMsg.includes(p));
  
  if (mentioned) {
    session.expectingParasites = false;
    return `Wenn du ${mentioned} bemerkt hast, solltest du deinen Hund gründlich untersuchen und ggf. den Tierarzt kontaktieren. 🐾`;
  }

  return "Magst du mir sagen, ob du Flöhe, Zecken oder ähnliches gesehen hast?";
  }

  // BEHAVIOR AGGRESSIVE QUESTION FLOW 
  const behaviorTriggers = this.symptomData.behaviorTriggers || [];
  const behaviorKeywords = this.symptomData.behaviorKeywords || [];


  if (behaviorTriggers.some(t => new RegExp(`\\b${t}\\b`, 'i').test(loweredMsg)) || session.expectingBehavior) {
    if (!session.expectingBehavior) {
      session.expectingBehavior = true;
      return "Wie äußert sich das Verhalten? Bellt er viel, beißt er, oder ist er eher ängstlich?";
    }

    const confirmedBehavior = behaviorKeywords.find(b => loweredMsg.includes(b));
    if (confirmedBehavior) {
      session.expectingBehavior = false; 
      return `${confirmedBehavior.charAt(0).toUpperCase() + confirmedBehavior.slice(1)} kann verschiedene Ursachen haben. Training oder ein Tierarztbesuch könnten helfen. 🧠🐾`;
    }
    return "Hilf mir weiter - zeigt er Aggression, Angst oder etwas anderes? Ich versuch's besser einzuordnen.";
  }


  // KNOWLEDGE BASE (dogHelpData) 
  for (const topic of this.knowledgeBase) {
    if (topic.topic === "begrüßung") continue;
    if (!topic.ownerTypes.includes(session.ownerType)) continue;

    for (const kw of (topic.keywords || [])) {
      if (loweredMsg.includes(kw)) {
        const reply = this.getRandom(topic.answers);
        return reply.replace("${userName}", session.userName);
      }
    }
  }

  // BREED INFO (SIZE / AG)
  if (loweredMsg.includes("wie groß wird") || loweredMsg.includes("wie alt wird")) {
    const match = msg.match(/wird ein (.+?)\?/i);
    if (match) {
      const breedName = match[1];
      const breed = await searchBreedInfo(breedName);
      if (breed) {
        return `${breed.name}: Lebenserwartung ${breed.lifespan}, Größe: ${breed.height} cm, Gewicht: ${breed.weight} kg.`;
      } else {
        return "Hmm... diese Rasse kenne ich leider nicht 🐾";
      }
    }
  }

  // BREED IMAGE 
  if ((loweredMsg.includes("bild") || loweredMsg.includes("foto")) &&
      (loweredMsg.includes("von") || loweredMsg.includes("vom"))) {
    const match = loweredMsg.match(/(?:bild|foto)[^a-zA-Zäöüß]*(?:von|vom)\s+([a-zäöüß\s\-]+)/i);
    if (match) {
      let breedName = match[1].trim();
      breedName = breedName.replace(/\b(zeigen|bitte|kannst|kannt|mir|du|ein|bild|photo|foto)\b/gi, '').trim();
      const imageUrl = await getBreedImage(breedName);
      if (imageUrl) {
        return `Hier ist ein Bild von einem ${breedName}: <img src="${imageUrl}" alt="${breedName}" style="max-width:100%;">`;
      } else {
        return `Ich habe leider kein Bild für "${breedName}" gefunden. Hast du vielleicht einen anderen Rasse-Namen für mich? 🐶`;
      }
    }
  }

  //OWNER TYPE PROMPT (only if still UNKNOWNN) 
  if (!session.ownerType) {
  const detected = this.detectOwnerType(msg);
  if (detected) {
    session.ownerType = detected;
    session.ownerPromptCount = 0; 
    return this.generateGreeting(userId, session);
  }

  session.ownerPromptCount += 1;

  if (session.ownerPromptCount >= 2) {
    return `Bist du neuer, erfahrener Hundebesitzer oder Gast?`;
  } else {
    return this.getRandom(this.fallbacks);
  }
}


  // FALLBACK
  return this.getRandom(this.fallbacks);
}


  // Entry point for chat
  async post(userId, msg) {
    const reply = await this.processMessage(userId, msg);

    const session = this.sessions.get(userId);
    if (session && session.chatHistory) {
      session.chatHistory.push({ question: msg, answer: reply });
      if (session.chatHistory.length > 10) session.chatHistory.shift(); 
    }

    const targetSocket = [...this.wss.clients].find(client => client.userId === userId && client.readyState === WebSocket.OPEN);
    if (targetSocket) {
      targetSocket.send(JSON.stringify({ type: 'msg', name: 'PawPal', msg: reply }));
    }
  }

  // Broadcast to all WebSocket clients
  broadcast(msg) {
    this.wss.clients?.forEach?.(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  }

  connect() {
    console.log("PawPal Chatbot läuft sauber datengetrieben");
  }
}

module.exports = Bot;