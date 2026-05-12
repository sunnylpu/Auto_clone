var safe = function (promise, fallback) {
  return promise.catch(function () { return fallback; });
};

/**
 * context: "board" | "list" | "card"
 * Pass context via URL query param for reliable detection in the React app.
 */
function openPopup(t, context) {
  return t.popup({
    url: "./index.html?ctx=" + context + "&v=" + Date.now(),
    height: 400,
    accentColor: "#2b2c2f",
    args: {
      context: context,
    },
  });
}

window.TrelloPowerUp.initialize({
  "board-buttons": function () {
    return [{
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "board"); },
    }];
  },

  "card-buttons": function () {
    return [{
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "card"); },
    }];
  },

  "list-actions": function () {
    return [{
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "list"); },
    }];
  },

  "card-back-section": function(t, options) {
    return t.get("board", "shared", "autoCloneRules").then(function(rules) {
      if (!rules) return null;
      var cardId = options.card ? options.card.id : null;
      var rule = rules.find(function(r) { return r.srcId === cardId && r.active; });
      if (!rule) return null; // Only show if this card has an active rule

      return {
        title: 'Auto Clone',
        icon: 'https://cdn-icons-png.flaticon.com/512/2889/2889312.png',
        content: {
          type: 'iframe',
          url: t.signUrl('./index.html?ctx=cardback&cardId=' + cardId),
          height: 80
        }
      };
    });
  }
});