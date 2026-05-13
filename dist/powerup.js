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
  "board-buttons": function (t) {
    return [{
      icon: t.signUrl('./logo.png'),
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "board"); },
    }];
  },

  "card-buttons": function (t) {
    return [{
      icon: t.signUrl('./logo.png'),
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "card"); },
    }];
  },

  "list-actions": function (t) {
    return [{
      icon: t.signUrl('./logo.png'),
      text: "Auto Clone",
      callback: function (t) { return openPopup(t, "list"); },
    }];
  },

  "card-back-section": function(t, options) {
    return Promise.all([
      t.card('id'),
      t.get('board', 'shared', 'autoCloneRules')
    ]).then(function(data) {
      var card = data[0];
      var rules = data[1];
      if (!card || !rules) return null;
      
      var rule = rules.find(function(r) { return r.srcId === card.id && r.active; });
      if (!rule) return null;

      return {
        title: 'Auto Clone',
        icon: 'https://cdn-icons-png.flaticon.com/512/2889/2889312.png',
        content: {
          type: 'iframe',
          url: t.signUrl('./index.html?ctx=cardback&cardId=' + card.id),
          height: 80
        }
      };
    }).catch(function(e) {
      return null;
    });
  }
});