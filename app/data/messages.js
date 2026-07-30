/**
 * The Truce message library — 56 hand-written apology messages.
 *
 * Schema: { t: text, s: style ('sweet'|'funny'|'poetic'|'heart'), who: tags }
 * who tags: 'any' | 'romantic' | 'friend' | 'family'.
 * A message is shown when its style matches AND its who[] contains the
 * recipient's tag or 'any' (see lib/messages filtering in the wizard).
 *
 * To add an occasion later, add messages with a new style/occasion tag and
 * extend the filter — the schema is intentionally boring and easy to extend.
 */
const MESSAGES = [
  // ---------- SWEET ----------
  { t: "I keep replaying it and wishing I could take it back. You deserve so much better than that, and I hope you will let me show you I know it. 🥺", s: "sweet", who: ["any"] },
  { t: "You have such a soft heart, and I hate that I was careless with it. I am sorry, and I am grateful you are even reading this. 💕", s: "sweet", who: ["any"] },
  { t: "You are one of the kindest people I know, and kindness like that should never have to absorb my mistakes. I am sorry, truly. 🥺", s: "sweet", who: ["any"] },
  { t: "There is a version of that day where I chose differently, and I wish I had lived in it instead. I am sorry for the one we got. 💕", s: "sweet", who: ["any"] },
  { t: "You make everything around you gentler just by being in it, and I forgot to be gentle back. I am sorry. 🥺💕", s: "sweet", who: ["any"] },
  { t: "I am not asking you to forget it, just to let me try again. You mean too much to me for things to stay like this. 🥺", s: "sweet", who: ["any"] },
  { t: "You are still the softest place I know, and I hate that I made it feel unsafe for even a moment. I am sorry, and I miss you. 💗", s: "sweet", who: ["romantic"] },
  { t: "Falling asleep next to you is the best part of my day, and I ruined that feeling for both of us. I am sorry, and I miss you already. 🥰", s: "sweet", who: ["romantic"] },
  { t: "You have loved me through so much, and I repaid that with carelessness. I am sorry, and I want to be worth the love you keep giving me. 💗🥺", s: "sweet", who: ["romantic"] },
  { t: "I still want to be the one who makes your bad days better, not the reason for one. I am sorry, and I am here whenever you are ready. 🥰💕", s: "sweet", who: ["romantic"] },
  { t: "You have shown up for me more times than I can count, and I hate that I was not the friend you needed this time. I am sorry. 🤗", s: "sweet", who: ["friend"] },
  { t: "Best friends are supposed to make life softer, not harder, and I got that backwards. I am sorry, and I miss your laugh already. 🌷🤗", s: "sweet", who: ["friend"] },
  { t: "You have loved me since before I could even say thank you, and I still find ways to take it for granted. I am sorry, and I love you more than I show. 💛", s: "sweet", who: ["family"] },
  { t: "You raised me to say sorry and mean it, so here I am, meaning it completely. I am sorry, and thank you for still picking up the phone. 💛🌷", s: "sweet", who: ["family"] },

  // ---------- FUNNY ----------
  { t: "I have officially been promoted from occasionally wrong to demonstrably wrong, and I accept the title. I am sorry, and I brought snacks as a peace offering. 😅🙏", s: "funny", who: ["any"] },
  { t: "In my defense, I had a whole plan that made sense in my head, which is apparently where all my worst ideas live rent free. I am sorry. 😅", s: "funny", who: ["any"] },
  { t: "I would like to formally apologize on behalf of my mouth, which continues to operate without checking in with my brain first. Truce? 🙈", s: "funny", who: ["any"] },
  { t: "I have replayed what I said so many times I could perform it as a one man show, and the reviews would not be kind. I am sorry. 😬", s: "funny", who: ["any"] },
  { t: "Turns out I am not as funny or as right as I think I am, which is a humbling combo. I am sorry, and I promise to consult you before my next terrible idea. 😅🙏", s: "funny", who: ["any"] },
  { t: "I googled how to apologize properly and it just said mean it, which felt aggressively unhelpful, so here is my best attempt anyway. I am sorry. 😭", s: "funny", who: ["any"] },
  { t: "I have been sentenced to the couch of my own making, and honestly, the verdict is fair. I am sorry, please let me come back to the good pillows. 😅🙏", s: "funny", who: ["romantic"] },
  { t: "I am willing to admit, in writing, that you were right and I was wrong, and I would like this to count as historical record. I am sorry, and I already miss arguing with you about the thermostat. 😅💕", s: "funny", who: ["romantic"] },
  { t: "My track record for winning arguments with you is currently zero for a lot, and I am starting to suspect that is not a coincidence. I am sorry for this one especially. 😅", s: "funny", who: ["romantic"] },
  { t: "I have workshopped several excuses and none of them survived contact with the truth, so I am left with the boring but accurate one: I messed up. I am sorry. 🙈", s: "funny", who: ["romantic"] },
  { t: "I would like to point out that best friends get a lifetime pass for occasional idiocy, and I am cashing mine in right now. I am sorry. 😅🙏", s: "funny", who: ["friend"] },
  { t: "You have seen me at my most ridiculous for years and stuck around anyway, so I am hoping that streak holds one more time. I am sorry for this one. 😬", s: "funny", who: ["friend"] },
  { t: "I know you raised me better than this, and honestly the disappointment in your voice was more effective than any punishment ever was. I am sorry. 😬🙏", s: "funny", who: ["family"] },
  { t: "Somewhere you are shaking your head thinking you did not raise me to act like that, and you would be correct. I am sorry, and yes, you can say you told me so. 😅", s: "funny", who: ["family"] },

  // ---------- POETIC ----------
  { t: "Some words leave the mouth like stones and land like them too. I am sorry mine landed on you. 🕊️", s: "poetic", who: ["any"] },
  { t: "I did not mean to become weather in your day, something you had to brace for instead of enjoy. I am sorry, and I hope the sky clears. 🌙", s: "poetic", who: ["any"] },
  { t: "Trust is built slow, plank by plank, and I kicked one loose without thinking about who was standing on it. I am sorry. ✨", s: "poetic", who: ["any"] },
  { t: "There is a quiet that follows a mistake, heavier than any silence before it. I am sitting in that quiet now, and I am sorry. 🌙", s: "poetic", who: ["any"] },
  { t: "I keep turning the moment over like a stone in my pocket, hoping a different side will show. It never does. I am sorry. 🕊️", s: "poetic", who: ["any"] },
  { t: "Some doors close so softly you do not hear it happen until you reach for the handle. I am sorry I left you reaching. ✨", s: "poetic", who: ["any"] },
  { t: "You have always been the warm room in my winters, and I do not know why I let the cold in this time. I am sorry, and I am asking to come back inside. 🌹✨", s: "poetic", who: ["romantic"] },
  { t: "We built something with careful hands, and I was careless with it for one bad hour. I am sorry, and I want to help rebuild whatever I chipped. 🌹", s: "poetic", who: ["romantic"] },
  { t: "Your love has always felt like a shoreline, patient and constant, and I still managed to drift. I am sorry, and I am rowing back. 🌙✨", s: "poetic", who: ["romantic"] },
  { t: "If our story is a long river, this was one rough stretch of water, not the whole current. I am sorry, and I still want the rest of the journey with you. 🌹🕊️", s: "poetic", who: ["romantic"] },
  { t: "Good friendships are old trees, deep roots that a single storm should not be able to topple. I am sorry I shook the branches so hard. 🕊️", s: "poetic", who: ["friend"] },
  { t: "You have been a steady lantern on a lot of my darker nights, and I let mine flicker out on you this time. I am sorry. ✨", s: "poetic", who: ["friend"] },
  { t: "You gave me my first sense of home, long before I understood what that word meant. I am sorry I made it feel unsteady, even briefly. 🕊️", s: "poetic", who: ["family"] },
  { t: "Everything gentle I know how to do, I learned by watching you first. I am sorry I forgot the lesson for a moment. ✨", s: "poetic", who: ["family"] },

  // ---------- HEART ----------
  { t: "What I said was unfair, and I do not have a good reason for it. I am sorry, and I understand if it takes time to trust that I mean it. 🙏", s: "heart", who: ["any"] },
  { t: "I hurt you, and I am not going to explain it away or ask you to see my side first. I am sorry, plainly and completely. 🤍", s: "heart", who: ["any"] },
  { t: "I was careless with something that mattered to you, and that is on me, not on the circumstances around it. I am sorry. 🙏", s: "heart", who: ["any"] },
  { t: "I know an apology does not erase what happened, but I still need you to hear it. I am sorry for the hurt I caused, no conditions attached. ❤️‍🩹", s: "heart", who: ["any"] },
  { t: "I let my own frustration become your problem, and that was not fair to you. I am sorry, and I am working on doing better than that. 🙏", s: "heart", who: ["any"] },
  { t: "I have thought about this from your side, not just mine, and I do not like what I see. I am sorry, and I mean it without any buts attached. 🤍", s: "heart", who: ["any"] },
  { t: "I broke something between us that you trusted me to protect, and I take full responsibility for that. I am sorry, and I am ready to do the harder work of repairing it, however long that takes. 💗🙏", s: "heart", who: ["romantic"] },
  { t: "You deserved honesty and patience from me, and instead you got neither in that moment. I am sorry, and I am not asking you to just move past it, only to know I see it clearly now. ❤️‍🩹", s: "heart", who: ["romantic"] },
  { t: "I chose my pride over your feelings, and that was the wrong choice every time I made it. I am sorry, and I want to be someone you do not have to brace yourself around. 💗", s: "heart", who: ["romantic"] },
  { t: "I hurt someone I promised to protect from exactly this kind of hurt. I am sorry, and I understand that trust is something I now have to earn back, not just ask for. ❤️‍🩹🙏", s: "heart", who: ["romantic"] },
  { t: "I let you down when you needed me to simply show up, and there is no excuse that makes that okay. I am sorry, and I know I have to earn back the trust, not just say the words. 🙏", s: "heart", who: ["friend"] },
  { t: "Real friends tell each other the truth, and the truth is I handled that badly and hurt you in the process. I am sorry, without any conditions on it. 🤍", s: "heart", who: ["friend"] },
  { t: "I know you have given me more patience over the years than I have earned, and I still let you down this time. I am sorry, and I am not looking for you to rush past it. 🙏", s: "heart", who: ["family"] },
  { t: "You taught me to take responsibility, and I owe it to you to actually do that now instead of explaining it away. I am sorry for the hurt I caused. 🤍", s: "heart", who: ["family"] },
];

export default MESSAGES;
export { MESSAGES };
