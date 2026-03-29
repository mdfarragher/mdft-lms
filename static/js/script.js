// Append ?next=<current path> to any login link on the page
(function () {
    var next = encodeURIComponent(window.location.pathname + window.location.search);
    ["nav-login-link", "lesson-signin-btn"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.href = "/login?next=" + next;
    });
})();
