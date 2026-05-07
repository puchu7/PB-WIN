const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const mongoose = require('mongoose');

app.use(express.json());

// 1. DATABASE CONNECTION (Fixed Address for Cloud)
mongoose.connect('mongodb+srv://atanu:atanu123@cluster0.mongodb.net/pbwin?retryWrites=true&w=majority')
.then(() => console.log("✅ Sabke liye Database Ready hai!"))
.catch(err => console.log("❌ DB Connection Error: Check Internet"));

// 2. USER MODEL
const User = mongoose.model('User', new mongoose.Schema({
    mobile: { type: String, unique: true },
    password: String,
    balance: { type: Number, default: 100 } // Naye user ko 100 bonus
}));

// 3. GAME VARIABLES
let timer = 60;
let period = 20260508001;
let history = [];
let nextResult = null; 
let currentBets = []; 

// 4. AUTH ROUTES
app.post('/register', async (req, res) => {
    const { mobile, password } = req.body;
    try {
        const newUser = new User({ mobile, password });
        await newUser.save();
        res.json({ success: true, message: "Account Ban Gaya! Login Karo." });
    } catch (err) {
        res.json({ success: false, message: "Mobile Number pehle se hai!" });
    }
});

app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;
    const user = await User.findOne({ mobile, password });
    if(user) {
        res.json({ success: true, message: "Login Successful!", balance: user.balance });
    } else {
        res.json({ success: false, message: "Mobile ya Password galat hai!" });
    }
});

// 5. BETTING ROUTE (Balance Minus Logic)
app.post('/place-bet', async (req, res) => {
    const { mobile, amount, betOn } = req.body;
    try {
        const user = await User.findOne({ mobile });
        if (user && user.balance >= amount) {
            user.balance -= amount;
            await user.save();
            currentBets.push({ amount: parseInt(amount), betOn: betOn });
            res.json({ success: true, message: "Bet Lag Gayi!", newBalance: user.balance });
        } else {
            res.json({ success: false, message: "Balance kam hai!" });
        }
    } catch (err) {
        res.json({ success: false, message: "Error ho gaya!" });
    }
});

// 6. ADMIN CONTROL
app.post('/admin/set-result', (req, res) => {
    nextResult = parseInt(req.body.number);
    res.json({ success: true, message: "Agla result set: " + nextResult });
});

// 7. GAME ENGINE (Profit Logic: Kam paisa jitega)
setInterval(() => {
    timer--;
    if (timer <= 0) {
        timer = 60;
        let finalNumber;

        if (nextResult !== null) {
            finalNumber = nextResult; 
        } else if (currentBets.length > 0) {
            // Profit Logic
            let moneyOnNumbers = Array(10).fill(0);
            currentBets.forEach(bet => {
                if (typeof bet.betOn === 'number') moneyOnNumbers[bet.betOn] += bet.amount;
            });
            // Jis number par sabse kam paisa, wahi winner
            finalNumber = moneyOnNumbers.indexOf(Math.min(...moneyOnNumbers));
        } else {
            finalNumber = Math.floor(Math.random() * 10);
        }

        const size = finalNumber >= 5 ? "Big" : "Small";
        const color = (finalNumber === 0 || finalNumber === 5) ? "Violet" : (finalNumber % 2 === 0 ? "Red" : "Green");

        history.unshift({ period, number: finalNumber, size, color });
        if(history.length > 10) history.pop();

        period++;
        nextResult = null;
        currentBets = []; 
    }
    io.emit('tick', { timer, period, history });
}, 1000);

http.listen(3000, () => {
    console.log('🚀 Server is LIVE on port 3000');
});
