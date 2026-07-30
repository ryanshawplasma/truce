/**
 * Occasion message libraries for the Truce card app — birthday and proposal.
 *
 * Same schema as the core apology library: { t: text, s: style, who: tags }.
 * s: 'sweet' | 'funny' | 'poetic' | 'heart'.
 * who tags: 'any' | 'romantic' | 'friend' | 'family'.
 */

export const BIRTHDAY_MESSAGES = [
  // ---------- SWEET ----------
  { t: "Hope today feels as good as you make everyone around you feel. Happy birthday to someone truly special. 🎂💕", s: "sweet", who: ["any"] },
  { t: "Sending you the warmest happy birthday and all the soft, good moments today can hold. You deserve every bit of it. ✨🎈", s: "sweet", who: ["any"] },
  { t: "Waking up next to you today might be my favorite gift of all. Happy birthday to my favorite person in the whole world. 💕🎂", s: "sweet", who: ["romantic"] },
  { t: "You make ordinary days feel like something worth celebrating, so today gets to be extra. Happy birthday, love. 🥰✨", s: "sweet", who: ["romantic"] },
  { t: "So grateful you were born on this exact day, because my life is better with you in it. Happy birthday, friend. 🎈💕", s: "sweet", who: ["friend"] },
  { t: "Watching you grow into who you are has been one of my favorite things to witness. Happy birthday, I love you endlessly. 💛🎂", s: "sweet", who: ["family"] },

  // ---------- FUNNY ----------
  { t: "Happy birthday to the reason I still remember what a candle is for. Hope your day is chaotic in the best way possible. 🎉😂", s: "funny", who: ["any"] },
  { t: "It's your birthday, which means cake for breakfast is now scientifically justified. Enjoy the loophole. 🎂🙌", s: "funny", who: ["any"] },
  { t: "Happy birthday to the one person who laughs at my terrible jokes on purpose. Lucky for you, the cake is way funnier than me. 🎉😂", s: "funny", who: ["romantic"] },
  { t: "You get more impressive every year while I still can't work the TV remote. Happy birthday, genius. 🥳😂", s: "funny", who: ["romantic"] },
  { t: "Happy birthday to my partner in questionable decisions and excellent snack choices. Let's go ruin today responsibly. 🎉🙌", s: "funny", who: ["friend"] },
  { t: "Happy birthday to the sibling who still owes me for covering for them roughly a thousand times. I'll allow it, just this once. 😂🎈", s: "funny", who: ["family"] },

  // ---------- POETIC ----------
  { t: "May today be gentle and golden, the kind of day that stays warm in your memory long after the candles go dark. Happy birthday. ✨🕯️", s: "poetic", who: ["any"] },
  { t: "Here's to the day the world got quietly, permanently better. Happy birthday, and may this year unfold exactly as it should. 🌙✨", s: "poetic", who: ["any"] },
  { t: "Every year I fall a little further into loving you, and I don't think that pattern is going to break anytime soon. Happy birthday, my favorite constant. 🌹✨", s: "poetic", who: ["romantic"] },
  { t: "You are the softest kind of miracle, the ordinary Tuesday that turned out to change everything. Happy birthday, love. 🌙💫", s: "poetic", who: ["romantic"] },
  { t: "Some people just make a room feel like home the second they walk in, and you've been doing that for me for years. Happy birthday. 🕊️✨", s: "poetic", who: ["friend"] },
  { t: "Long before I had the words for it, you taught me what love was supposed to feel like. Happy birthday, and thank you for all of it. ✨🎈", s: "poetic", who: ["family"] },

  // ---------- HEART ----------
  { t: "I hope you know how loved you are, today and every day that isn't your birthday too. Happy birthday, truly. 🤍🎂", s: "heart", who: ["any"] },
  { t: "Thank you for being exactly who you are, no notes. Happy birthday, and here's to another year of being lucky to know you. 🎈❤️", s: "heart", who: ["any"] },
  { t: "Loving you is the easiest good decision I make every single day. Happy birthday to the person who makes my life make sense. ❤️🎂", s: "heart", who: ["romantic"] },
  { t: "You are my favorite person to build a life with, birthdays included. I love you more than today's cake can hold. 🥰❤️", s: "heart", who: ["romantic"] },
  { t: "I don't say it enough, but having you as a friend has made my life genuinely better. Happy birthday, and thank you for being you. 🤍🎈", s: "heart", who: ["friend"] },
  { t: "You have shown up for me my whole life without ever needing to be asked. Happy birthday, and thank you for everything you are to me. 💛🙏", s: "heart", who: ["family"] },
];

export const PROPOSAL_MESSAGES = [
  // ---------- SWEET ----------
  { t: "I've known for a while that you're the best part of my day, every single day. Will you be mine? 🥺❤️", s: "sweet", who: ["romantic"] },
  { t: "I don't want to keep pretending this is casual, because it stopped feeling casual a long time ago. Be mine? 💍✨", s: "sweet", who: ["romantic"] },
  { t: "You make the ordinary parts of life feel like something worth looking forward to, and I want all of it with you. Will you be mine, officially? 🌹❤️", s: "sweet", who: ["romantic"] },
  { t: "I keep picturing my future and you're just there, in every version of it. So, will you be mine? 🥺💍", s: "sweet", who: ["romantic"] },

  // ---------- FUNNY ----------
  { t: "I've made a pros and cons list about asking you this, and the cons section is embarrassingly empty. Will you be mine? 🥺❤️", s: "funny", who: ["romantic"] },
  { t: "I rehearsed this about twelve times in the mirror and I'm still going to mess it up, so here goes nothing: be mine? 🥺✨", s: "funny", who: ["romantic"] },
  { t: "Fair warning, I already told my friends you said yes, so really you're just catching up now. Will you marry me? 💍✨", s: "funny", who: ["romantic"] },
  { t: "I ran the numbers and dating anyone else sounds exhausting, so let's just make this official. Be mine, forever? 💍🥺", s: "funny", who: ["romantic"] },

  // ---------- POETIC ----------
  { t: "Some people spend years looking for their person, and I found mine somewhere between your laugh and your bad morning hair. Will you be mine? 🌹✨", s: "poetic", who: ["romantic"] },
  { t: "I want to be the small, steady thing in your life, the one you come home to on the hardest days. Be mine? ✨🥺", s: "poetic", who: ["romantic"] },
  { t: "If forever is even real, I want to spend all of it learning the rest of you. Marry me? 💍🌹", s: "poetic", who: ["romantic"] },
  { t: "You turned an ordinary year into the best story I've ever lived, and I don't want the next chapter without you in it. Will you be mine, for good this time? ✨❤️", s: "poetic", who: ["romantic"] },

  // ---------- HEART ----------
  { t: "I love you without any conditions or exit plans, and I want to say that out loud, officially. Will you be mine? ❤️🥺", s: "heart", who: ["romantic"] },
  { t: "You are the safest, most honest love I've ever known, and I don't want to keep it undefined any longer. Be mine? ❤️✨", s: "heart", who: ["romantic"] },
  { t: "I've thought this through completely, and there is no version of my life I want more than the one with you in it. Will you marry me? 💍❤️", s: "heart", who: ["romantic"] },
  { t: "I'm not nervous about much, but I'm nervous about this, because I want the answer more than I've ever wanted anything. Will you be mine? 🥺💍", s: "heart", who: ["romantic"] },
];
