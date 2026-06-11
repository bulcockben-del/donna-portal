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

function removeExpiredMinutes(user){

    if(!user.minutePackages){

        return;

    }

    const now = new Date();

    user.minutePackages =
    user.minutePackages.filter(package=>{

        const addedDate =
        new Date(package.dateAdded);

        const expiryDate =
        new Date(addedDate);

        expiryDate.setMonth(
            expiryDate.getMonth() + 3
        );

        return expiryDate > now;

    });

    user.minutes = 0;

    user.minutePackages.forEach(package=>{

        user.minutes +=
        package.remaining;

    });

}

function getExpiringPackages(user){

    if(!user.minutePackages){

        return [];

    }

    const now = new Date();

    return user.minutePackages.filter(package=>{

        const addedDate =
        new Date(package.dateAdded);

        const expiryDate =
        new Date(addedDate);

        expiryDate.setMonth(
            expiryDate.getMonth() + 3
        );

        const daysUntilExpiry =

            (expiryDate - now) /

            (1000 * 60 * 60 * 24);

        return daysUntilExpiry <= 7 &&
               daysUntilExpiry > 0;

    });

}

app.get("/users", (req, res) => {

    const users = getUsers();

    users.forEach(user=>{

        removeExpiredMinutes(user);

    });

    saveUsers(users);

    res.json(users);

});

app.post("/add-minutes", (req, res) => {

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.id
    );

    if(user){

        user.minutes += req.body.minutes;

        if(req.body.minutes > 0){

            if(!user.minutePackages){

                user.minutePackages = [];

            }

            user.minutePackages.push({

                minutes:req.body.minutes,

                remaining:req.body.minutes,

                dateAdded:new Date()

            });

        }

        saveUsers(users);

        res.json(user);

    }else {

        res.status(404).send("User not found");

    }

});

app.post("/use-session", (req, res) => {

    const users = getUsers();

    const user = users.find(
        u => u.id === req.body.id
    );

    if(user){

        if(req.body.minutes > user.minutes){

        return res.status(400).json({

            success:false,

            message:
            "Not enough minutes remaining."

        });

    }

        let minutesToDeduct =
        req.body.minutes;

        if(user.minutePackages){

            user.minutePackages.forEach(package=>{

                if(minutesToDeduct <= 0){

                    return;

                }

                const deduction = Math.min(

                    package.remaining,

                    minutesToDeduct

                );

                package.remaining -= deduction;

                minutesToDeduct -= deduction;

            });

        }

        user.minutePackages =
        user.minutePackages.filter(

            package => package.remaining > 0

        );

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
        u.email.toLowerCase() === req.body.email.toLowerCase() &&


        u.password === req.body.password
    );

    if(user){

        removeExpiredMinutes(user);

        user.expiringPackages =
        getExpiringPackages(user);

        saveUsers(users);

    }

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

    const existingUser = users.find(
        u =>
        u.email.toLowerCase() ===
        req.body.email.toLowerCase()
    );

    if(existingUser){

        return res.status(400).json({

            success:false,

            message:
            "An account with this email already exists."

        });

}

    const newUser = {

        id: Date.now(),

        name:req.body.name,

        email:req.body.email.toLowerCase(),

        password:req.body.password,

        minutes:0,

        role:"client",

        lastAppointment:"Never",

        lastAppointmentMinutes:0,

        history:[],

        minutePackages:[],

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

app.post("/create-admin",(req,res)=>{

    const users = getUsers();

    const existingUser = users.find(
        u =>
        u.email.toLowerCase() ===
        req.body.email.toLowerCase()
    );

    if(existingUser){

        return res.status(400).json({

            success:false,

            message:
            "An account with this email already exists."

        });

    }

    const newAdmin = {

        id: Date.now(),

        name:req.body.name,

        email:req.body.email.toLowerCase(),

        password:req.body.password,

        minutes:0,

        role:"admin"

    };

    users.push(newAdmin);

    saveUsers(users);

    res.json({
        success:true
    });

});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});