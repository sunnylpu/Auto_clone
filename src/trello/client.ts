declare global {
  interface Window {
    TrelloPowerUp: any;
  }
}

window.TrelloPowerUp.initialize({
  "board-buttons": function () {
    return [
      {
        icon: {
          dark: window.location.origin + "/logo.png",
          light: window.location.origin + "/logo.png",
        },
        text: "Auto Clone",
        callback: function (t: any) {
          return t.popup({
            title: "Auto Clone",
            url: window.location.origin,
            height: 500,
          });
        },
      },
    ];
  },
  "list-actions": function () {
    return [
      {
        icon: window.location.origin + "/logo.png",
        text: "Auto Clone",
        callback: function (t: any) {
          return t.popup({
            title: "Auto Clone",
            url: window.location.origin,
            height: 500,
          });
        },
      },
    ];
  },
});

export {};