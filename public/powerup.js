var safe = function (promise, fallback) {
  return promise.catch(function () { return fallback; });
};

/**
 * context: "board" | "list" | "card"
 * Pass context via URL query param for reliable detection in the React app.
 */
function openPopup(t, context) {
  return Promise.all([
    safe(t.member("all"), null),
    safe(t.lists("id", "name"), []),
    safe(t.cards("id", "name", "desc", "idList", "idMembers", "idLabels"), []),
    safe(t.card("id", "name", "desc", "idList", "idMembers", "idLabels"), null),
    safe(t.list("id", "name"), null),
  ]).then(function (results) {
    var member = results[0];
    var lists = results[1];
    var cards = results[2];
    var currentCard = results[3];
    var currentList = results[4];

    var payload = {
      member: member,
      lists: lists,
      cards: cards,
      currentCard: currentCard,
      currentList: currentList,
    };

    safe(t.set("board", "shared", "autoClonePrefetch", payload), null);

    return t.popup({
      title: "Auto Clone",
      url: "./index.html?ctx=" + context + "&v=" + Date.now(),
      height: 540,
      accentColor: "#2b2c2f",
      args: {
        context: context,
        prefetch: payload,
      },
    });
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
});