const { createClient } = require("@supabase/supabase-js");

const express = require("express");


const supabaseUrl = "https://fcerfynwnpikxnwgtzvz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZXJmeW53bnBpa3hud2d0enZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTAxMzAsImV4cCI6MjA5Njc4NjEzMH0.zuNYFk9YEjE7DKkgn_gl8AYCdJ9QaOuL30N7VE10INU";

const supabase = createClient(
    supabaseUrl,
    supabaseKey
);


const app = express();

app.use(express.json());
app.use(express.static("public"));

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

async function saveExpiredChanges(user){

    const originalMinutes =
    user.minutes;

    const originalPackages =
    JSON.stringify(
        user.minutePackages || []
    );

    removeExpiredMinutes(user);

    const updatedPackages =
    JSON.stringify(
        user.minutePackages || []
    );

    if(
        originalMinutes !== user.minutes ||
        originalPackages !== updatedPackages
    ){

        await supabase
            .from("users")
            .update({

                minutes:user.minutes,

                minutePackages:user.minutePackages

            })
            .eq("id", user.id);

    }

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

app.get("/users", async (req, res) => {

    const { data: users, error } =
    await supabase
        .from("users")
        .select("*");

    if(error){

        console.log(error);

        return res.status(500).send(
            "Database error"
        );

    }

    for(const user of users){

        await saveExpiredChanges(user);

    }

    res.json(users);

});

app.post("/add-minutes", async (req, res) => {

    const { data: user, error } =
    await supabase
        .from("users")
        .select("*")
        .eq("id", req.body.id)
        .single();

    if(error || !user){

        return res.status(404).send(
            "User not found"
        );

    }

    await saveExpiredChanges(user);
    
    if(!user.minutePackages){

        user.minutePackages = [];

    }

    if(req.body.minutes > 0){

        user.minutes += req.body.minutes;

        user.minutePackages.push({

            minutes:req.body.minutes,

            remaining:req.body.minutes,

            dateAdded:new Date()

        });

    } else {

        let minutesToRemove =
        Math.abs(req.body.minutes);

        user.minutePackages.forEach(package=>{

            if(minutesToRemove <= 0){

                return;

            }

            const deduction = Math.min(

                package.remaining,

                minutesToRemove

            );

            package.remaining -= deduction;

            minutesToRemove -= deduction;

        });

        user.minutePackages =
        user.minutePackages.filter(

            package => package.remaining > 0

        );

        user.minutes = 0;

        user.minutePackages.forEach(package=>{

            user.minutes +=
            package.remaining;

        });

    }

    const { error:updateError } =
    await supabase
        .from("users")
        .update({

            minutes:user.minutes,

            minutePackages:user.minutePackages

        })
        .eq("id", req.body.id);

    if(updateError){

        console.log(updateError);

        return res.status(500).send(
            "Database error"
        );

    }

    res.json(user);

});

app.post("/use-session", async (req, res) => {

    const { data: user, error } =
    await supabase
        .from("users")
        .select("*")
        .eq("id", req.body.id)
        .single();

    if(error || !user){

        return res.status(404).send(
            "User not found"
        );

    }

    await saveExpiredChanges(user);

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

    const { error:updateError } =
    await supabase
        .from("users")
        .update({

            minutes:user.minutes,

            minutePackages:user.minutePackages,

            history:user.history,

            lastAppointment:user.lastAppointment,

            lastAppointmentMinutes:
            user.lastAppointmentMinutes

        })
        .eq("id", req.body.id);

    if(updateError){

        console.log(updateError);

        return res.status(500).json({

            success:false

        });

    }

    res.json(user);

});

app.post("/login", async (req, res) => {

    const { data: user, error } =
    await supabase
        .from("users")
        .select("*")
        .eq(
            "email",
            req.body.email.toLowerCase()
        )
        .eq(
            "password",
            req.body.password
        )
        .single();

    if(error || !user){

        return res.status(401).json({
            success:false
        });

    }

    await saveExpiredChanges(user);

    user.expiringPackages =
    getExpiringPackages(user);

    res.json({
        success:true,
        role:user.role,
        user:user
    });

});

app.post("/register", async (req, res) => {

    const { data: existingUser } =
    await supabase
        .from("users")
        .select("*")
        .eq(
            "email",
            req.body.email.toLowerCase()
        )
        .single();

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

        safetyAccepted:req.body.safetyAccepted

    };

    const { error } =
    await supabase
        .from("users")
        .insert([newUser]);

    if(error){

        console.log(error);

        return res.status(500).json({

            success:false

        });

    }

    res.json({

        success:true

    });

});

app.post("/create-admin", async (req, res) => {

    const { data: existingUser } =
    await supabase
        .from("users")
        .select("*")
        .eq(
            "email",
            req.body.email.toLowerCase()
        )
        .single();

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

        role:"admin",

        history:[],

        minutePackages:[],

        lastAppointment:"Never",

        lastAppointmentMinutes:0,

        phone:"",

        dob:"",

        skinType:"",

        notes:"",

        over18:true,

        safetyAccepted:true

    };

    const { error } =
    await supabase
        .from("users")
        .insert([newAdmin]);

    if(error){

        console.log(error);

        return res.status(500).json({

            success:false

        });

    }

    res.json({

        success:true

    });

});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});