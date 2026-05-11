function openAutoClonePopup(t) {
  const safe = (promise, fallback) => promise.catch(() => fallback);
  return Promise.all([
    safe(t.member("all"), null),
    safe(t.lists("id", "name"), []),
    safe(t.cards("id", "name", "desc", "idList", "idMembers", "idLabels"), []),
    safe(t.card("id", "name", "desc", "idList", "idMembers", "idLabels"), null),
    safe(t.list("id", "name"), null),
  ]).then(function ([member, lists, cards, currentCard, currentList]) {
    const payload = {
      member: member,
      lists: lists,
      cards: cards,
      currentCard: currentCard,
      currentList: currentList,
    };

    // Backup cache for contexts where popup args may be unavailable.
    safe(t.set("board", "shared", "autoClonePrefetch", payload), null);

    return t.popup({
      title: "Auto Clone",
      url: "/",
      height: 540,
      accentColor: "#2b2c2f",
      args: {
        prefetch: payload,
      },
    });
  });
}

window.TrelloPowerUp.initialize({
  "board-buttons": function () {
    return [
      {
        text: "Auto Clone",
        callback: function (t) {
          return openAutoClonePopup(t);
        },
      },
    ];
  },

  "card-buttons": function () {
    return [
      {
        text: "Auto Clone",
        callback: function (t) {
          return openAutoClonePopup(t);
        },
      },
    ];
  },

  "list-actions": function () {
    return [
      {
        text: "Auto Clone",
        callback: function (t) {
          return openAutoClonePopup(t);
        },
      },
    ];
  },
});