const express = require("express");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.static("public"));

function getUsers() {
    return JSON.parse(
        fs.readFileSync("users.json")
    );
}

function saveUsers(users) {
    fs.writeFileSync(
        "users.json",
        JSON.stringify(users, null, 2)
    );
}

app.get("/users", (req, res) => {

    res.json(
        getUsers()
    );

});

app.post("/add-minutes", (req, res) => {

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.id
    );

    if(user){

        user.minutes += req.body.minutes;

        saveUsers(users);

        res.json(user);

    } else {

        res.status(404).send("User not found");

    }

});

app.post("/use-session", (req, res) => {

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.id
    );

    if(user){

        user.minutes -= req.body.minutes;

        const today = new Date();

        if(!user.history){

        user.history = [];

        }

        user.history.push({

            date:
            today.toLocaleString(
                "en-GB"
            ),

            minutes:
            req.body.minutes

        });

        user.lastAppointment =
        today.toLocaleDateString("en-GB");

        user.lastAppointmentMinutes =
        req.body.minutes;

        saveUsers(users);

        res.json(user);

    } else {

        res.status(404).send(
            "User not found"
        );

    }

});

app.post("/login", (req, res) => {

    const users = getUsers();

    const user = users.find(
        u =>
        u.email === req.body.email &&
        u.password === req.body.password
    );

    if(user){

        res.json({
            success:true,
            role:user.role,
            user:user
        });

    } else {

        res.status(401).json({
            success:false
        });

    }

});

app.post("/register",(req,res)=>{

    const users = getUsers();

    const newUser = {

        id: Date.now(),

        name:req.body.name,

        email:req.body.email,

        password:req.body.password,

        minutes:0,

        role:"client",

        lastAppointment:"Never",

        lastAppointmentMinutes:0,

        history:[],

        phone:req.body.phone,

        dob:req.body.dob,

        skinType:req.body.skinType,

        notes:req.body.notes,

        over18:req.body.over18,

        safetyAccepted:req.body.safetyAccepted,

    };

    users.push(newUser);

    saveUsers(users);

    res.json({
        success:true
    });

});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});