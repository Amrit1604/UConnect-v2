const express = require("express");
const router = express.Router();

// LOG IF LOADED
console.log("🔥 pages.js LOADED");

// ABOUT PAGE
router.get("/about", (req, res) => {
    console.log("🔥 /about HIT");

    res.render("posts/about", {
        user: req.session.user || null,
        currentPath: "/about"
    });
});

// CONTACT PAGE
router.get('/contact', async (req, res) => {
    try {
        res.render('posts/contact', {
            user: req.user,
            title: "Contact",
            currentPath: "/contact",
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading Contact page");
    }
});

module.exports = router;
