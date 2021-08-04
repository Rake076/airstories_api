const express = require("express");
const mysql = require ("mysql");
const dotenv = require('dotenv');
const bodyParser = require("body-parser");
const crypto = require('crypto');
const { query } = require("express");
const multer = require("multer");
const path = require("path");
const { profile } = require("console");
const { stringify } = require("querystring");
'use strict';

// Storage engine 
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) =>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({
    storage: storage,
    limits: {fileSize:2097152}
})
const app = express();  

app.use('/coverImage', express.static('upload/images'));

const AES_METHOD = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16, checked with php
const key = 'lbwyBzfgzUIvXZFShJuikaWvLJhIVq36'; 

app.use(bodyParser.json()); //Accept JSON params
app.use(bodyParser.urlencoded({extended:true})); //Accept URL encoded params



dotenv.config({ path: './password.env'})


// const db = mysql.createConnection({
//     host: process.env.DATABASE_HOST,
//     user: process.env.DATABASE_USER,
//     password: process.env.DATABASE_PASSWORD,
//     database : process.env.DATABASE
// });


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password:'',
    database : 'air_stories'
});


// Copied Encryption.js from GitHub
function encrypt(text, password) {
    if (process.versions.openssl <= '1.0.1f') {
        throw new Error('OpenSSL Version too old, vulnerability to Heartbleed')
    }
    
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv(AES_METHOD, new Buffer(key), iv);
    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    let textParts = text.split(':');
    let iv = new Buffer(textParts.shift(), 'hex');
    let encryptedText = new Buffer(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(key), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}


db.connect( (error) => {

    if(error) {
        console.log(error)
    } else {
        console.log("MySQL connected...")
    }
})



app.get('/', (req, res) =>{
    console.log('Password: YetoHoga');
    var encryptedv = encrypt('YetoHoga', key);
    var decryptedv = decrypt(encryptedv);
    console.log('Encrypt: ' + encryptedv);
    console.log('Decrypt: ' + decryptedv);
    res.send("Hello! Welcome to Air Stories API. ------------ Value: YetoHoga  ----------- Encrypt: "+encryptedv+  "----------- Decrypt:  "+ decryptedv);
    
})

app.post('/register',(req, res, next) => {
    var post_data = req.body; //Get POST params

    var username = post_data.username;
    var plain_password = post_data.password;
    var email = post_data.email;
    
    var encrypted_password = encrypt(plain_password, key);


    db.query(`SELECT * from users where u_email="`+email+`"`, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length>1)
        {
            res.json('User already exists!!!');
        }
        else{
            // db.query('INSERT INTO `users`(`username`, `u_email`, `u_password`, `story_count`) VALUES (?,?,?,?)', [username, email, encrypted_password, 0], function(error, result, fields){
            db.query('INSERT INTO `users`(`username`, `u_email`, `u_password`) VALUES (?,?,?)', [username, email, encrypted_password], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                    res.json("Registration Error: ", error);
                });
                res.json("Registration Successful!");     
            })
        }
         
    });


})


app.post('/login', (req, res, next) => {

    var post_data = req.body;

    //Extract email and password from the request
    var email = post_data.email;
    var plain_password = post_data.password;

    db.query('SELECT * from users where u_email=?',[email], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
            var encrypted_password = result[0].u_password; //Get password of result if acccount exists            

            if( plain_password == decrypt(encrypted_password))
            {
                res.send(JSON.stringify(result[0])) // If password is true, return all information of the user.
            }
            else
            {
                res.send(JSON.stringify('WRONG PASSWORD'));       
            }            
        }
        else
        {
            res.json('User does not exist');
        }
    });

}) 



app.get('/user', (req, res, next) => {

    var user_id  = req.query.user_id;

    db.query('SELECT * from users where user_id =?',[user_id], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
                res.send(JSON.stringify(result[0])) // If password is true, return all information of the user.
        }
        else
        {
            res.json('User does not exist');
        }
    });

}) 

//Edit User Profile
app.post("/user", upload.single('cover'), (req, res) => {
    var post_data = req.body;
    var user_id = post_data.user_id;
    var username = post_data.username;
    var about = post_data.about;

    if (req.file.filename != null){
        var u_profile_image = "http://localhost:5000/coverImage/"+req.file.filename;
    }

    db.query("Select * from users where user_id = ?", [user_id], function(error, result, fields){
        db.on('error',function(error){
            console.log('[MySQL Error', error);
        });
        if(result && result.length)
        {
            db.query('UPDATE users SET username = ?, about = ?, u_profile_image = ? WHERE user_id = ?', [username, about, u_profile_image, user_id], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL User data update ERROR]', error);
                    res.json("User Data Update Error: ", error);
                });
                res.json("User data has successfully been updated!");                
                    console.log(req.file)
            })            
        }
        else
        {
            res.json("User does not exist");
        }
    })
})

//Get Users to recommend them stories.
app.get('/users', (req, res, next) => {

    var user_id = req.query.user_id;

    db.query('SELECT user_id, username, u_profile_image, about from users WHERE user_id != ?',[user_id], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
                res.send(JSON.stringify(result)) // If password is true, return all information of the user.
        }
        else
        {
            res.json('User does not exist');
        }
    });

}) 

// Search for users to recommend thems stories.
app.get('/users/search', (req, res, next) => {

    var user_id = req.query.user_id;
    var username = req.query.username;

    db.query('SELECT user_id, username, u_profile_image, about from users WHERE user_id != '+user_id+' AND username LIKE "%'+username+'%"', function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
                res.send(JSON.stringify(result)) // If password is true, return all information of the user.
        }
        else
        {
            res.json('User does not exist');
        }
    });

}) 

//Recommend a story to a user    
app.post('/users/recommend', (req, res, next) => {

    var recommender_id = req.body.recommender_id;
    var recommendee_id = req.body.recommendee_id;
    var story_id = req.body.story_id;
    var story_type = req.body.story_type;

    db.query(`SELECT * from story_recommendations where story_id =`+story_id+` AND recommender_id =`+recommender_id+` AND recommendee_id =`+recommendee_id+` AND story_type ="`+story_type+`"`, function(error, result, fields)
    // db.query(`SELECT * from story_recommendations where story_id =`+story_id+` AND recommender_id =`+recommender_id+` AND recommendee_id =`+recommendee_id+` AND story_type ="`+story_id+`";`, function(error, result, fields)
    {
        db.on('error', function(error){ 
            console.log('[MySQL ERROR]', error);
        });

        // res.json(result);
        if ( result && result.length)
        {
            if(story_type == "short_story"){
                res.json('Short Story has already been recommended');
            }
            else{
                res.json("Story has already been recommended!");
            }
        }
        else
        {
            db.query('INSERT INTO story_recommendations (rec_id, story_id, recommender_id, recommendee_id, story_type) VALUES (?,?,?,?,?)', [null, story_id, recommender_id, recommendee_id, story_type], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
        
            });

            if(story_type == "short_story")
                res.send("Short Story has successfully been recommended")
            else
                res.send("Story has successfully been recommended to user");
        }
        
    });
}) 


// Get all the recommendations for a user.
app.get('/users/recommend', (req, res, next) => {

    var user_id = req.query.user_id;
    var storyResult;
    var doesStoryExist = false;

    var queryString = 'SELECT story_recommendations.rec_id, story_recommendations.story_type, stories.story_id, stories.story_title, stories.coverImage, users.username from story_recommendations INNER JOIN stories on stories.story_id = story_recommendations.story_id INNER JOIN users on users.user_id = story_recommendations.recommender_id WHERE story_recommendations.story_type = "story" AND story_recommendations.recommendee_id =' + user_id;
    db.query(queryString, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
            doesStoryExist = true;
                storyResult = result;
        }
        else
        {
            doesStoryExist = false;
        }
    });


    queryString = 'SELECT story_recommendations.rec_id, story_recommendations.story_type, short_stories.shortID, short_stories.shortTitle, short_stories.coverImage, users.username from story_recommendations INNER JOIN short_stories on short_stories.shortID = story_recommendations.story_id INNER JOIN users on users.user_id = story_recommendations.recommender_id WHERE story_recommendations.story_type = "short_story" AND story_recommendations.recommendee_id =' + user_id;
    db.query(queryString, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length)
        {
            var parseResult = JSON.parse(JSON.stringify(result).split('"shortID":').join('"story_id":'));
            parseResult = JSON.parse(JSON.stringify(parseResult).split('"shortTitle":').join('"story_title":'));

            if(doesStoryExist == true){
                var allResult = storyResult;
                allResult.push(parseResult);
                allResult = JSON.stringify(allResult);

                allResult = (allResult).split(',[').join(',');
                allResult = (allResult).split('}]').join('}');

                res.send(allResult);
            }
            else if (doesStoryExist == false){
                res.send(parseResult);
            }

        }
        else
        {

            if(doesStoryExist == true){
                res.send(storyResult);
            }
            else if (doesStoryExist == false){
                res.send(JSON.stringify("No recommendations found!"));
            }

            // var allResult = storyResult;
            // res.send(storyResult);
        }
        // res.send("No recommendations found!");
    });



}); 

// Remove a recommendation from user's recommendation list
app.get('/users/removeRecommendation', (req, res, next) =>{

    var rec_id = req.query.rec_id;

    db.query('SELECT * from story_recommendations WHERE rec_id = ' + rec_id, function(error, result, field){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
    
        if(result && result.length)
        {
            db.query("DELETE FROM `story_recommendations` WHERE rec_id = " + rec_id, function(error, result, field){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
                res.json("Recommendation has been removed");
            });
        }
        else{
            res.json("Recommendation does not exist!");
        }

    })

});


app.get('/shortStories', (req, res, next) =>{
    db.query('SELECT shortID, shortTitle, shortStory, shortGenre, appCount, shortDescription, coverImage, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id order by appCount desc', function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve short stories at the moment.');
        }
    });
});


app.get('/stories', (req, res, next) =>{

    db.query('SELECT story_id, story_title, story_description, story_genre, story_status, likes, readings, chapters, coverImage, users.username from stories INNER JOIN users on stories.user_id = users.user_id WHERE stories.story_status = 1 order by likes desc', function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});


app.get('/stories/chapters', (req, res, next) =>{

    var story_id = req.query.story_id;

    db.query('SELECT chapter_id, story_id, chapter_name, chapter_text, status from storychapters WHERE story_id = '+ story_id, function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });
        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});

// Delete a chapter.
app.get('/stories/chapters/delete', (req, res, next) =>{

    var chapter_id = req.query.chapter_id;

    db.query('SELECT * from storychapters WHERE chapter_id = '+ chapter_id , function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });
        if ( result && result.length)
        {            
            db.query('DELETE from storychapters WHERE chapter_id = '+ chapter_id , function(err, result, fields){
                db.on('error', function(err){ 
                    console.log('[MySQL ERROR]', err);
                });
            });
            res.json("Chapter has been deleted");
        }
        else
        {
            res.json('Chapter does not exist.');
        }
    });
});

app.get('/shortStories/search', (req, res, next) =>{

    var shortTitle = req.query.shortTitle;        

        db.query(`SELECT shortID, shortTitle, shortStory, shortGenre, appCount, shortDescription, coverImage, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id WHERE short_stories.shortTitle LIKE "%`+ shortTitle +`%"`, function(err, result, fields){
            db.on('error', function(err){ 
                console.log('[MySQL ERROR]', err);
            });
    
            if ( result && result.length)
            {            
                    res.send(JSON.stringify(result));
            }
            else
            {
                res.json('Unable to retrieve short stories at the moment.');
            }
        });
});

app.get('/stories/search', (req, res, next) =>{

    var storyTitle = req.query.storyTitle;
    db.query(`SELECT story_id, story_title, story_description, story_genre, story_status, likes, readings, chapters, coverImage, users.username from stories INNER JOIN users on stories.user_id = users.user_id WHERE stories.story_status = 1 AND stories.story_title LIKE "%`+ storyTitle +`%"`,function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});


app.get('/shortStories/search/genre', (req, res, next) =>{

    var shortGenre = req.query.shortGenre;        

        db.query(`SELECT shortID, shortTitle, shortStory, shortGenre, appCount, shortDescription, coverImage, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id WHERE short_stories.shortGenre LIKE "`+ shortGenre +`"`, function(err, result, fields){
            db.on('error', function(err){ 
                console.log('[MySQL ERROR]', err);
            });
    
            if ( result && result.length)
            {            
                    res.send(JSON.stringify(result));
            }
            else
            {
                res.json('Unable to retrieve short stories at the moment.');
            }
        });
});

app.get('/stories/search/genre', (req, res, next) =>{

    var storyGenre = req.query.storyGenre;
    db.query(`SELECT story_id, story_title, story_description, story_genre, story_status, likes, readings, chapters, coverImage, users.username from stories INNER JOIN users on stories.user_id = users.user_id WHERE stories.story_status = 1 AND stories.story_genre LIKE "`+ storyGenre +`"`,function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});


app.get('/shortStories/edit', (req, res, next) =>{

    var userID = req.query.userID;        

        db.query('SELECT shortID, shortTitle, shortStory, shortGenre, appCount, shortDescription, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id WHERE short_stories.user_id =' + userID, function(err, result, fields){
            db.on('error', function(err){ 
                console.log('[MySQL ERROR]', err);
            });
    
            if ( result && result.length)
            {            
                    res.send(JSON.stringify(result));
            }
            else
            {
                res.json('Unable to retrieve short stories at the moment.');
            }
        });
});


app.get('/shortStories/userStories',(req, res) =>{

    var userID = parseInt(req.query.userID);

    db.query('SELECT * from short_stories WHERE user_id =?', [userID], function(err, result, fields){
        db.on('error', function(err){
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('/shortStories/:userID - Unable to retrieve short stories at the moment.');
        }
    });

});

app.get('/stories/userStories', (req, res, next) =>{

    var userID = parseInt(req.query.userID);
    db.query('SELECT story_id, story_title, story_description, story_genre, story_status, likes, readings, chapters, coverImage, users.username from stories INNER JOIN users on stories.user_id = users.user_id WHERE stories.user_id =?', [userID],function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});


app.get('/shortStories/username',(req, res) =>{

    var username = req.query.username;
    // SELECT shortID, shortTitle, shortStory, shortGenre, appCount, shortDescription, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id
    db.query('SELECT user_id from users where username=?',[username], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {
            var userID = result[0].user_id; //Get user_id of result if acccount exists
            
            db.query('SELECT * from short_stories where user_id =?', [userID], function(err, resultSearch, fields){
                db.on('Error', function(err){
                    console.log('[MYSQL ERROR]', err);
                });
            
            if(resultSearch && resultSearch.length)
            {
                res.end(JSON.stringify(resultSearch[0]));
            }
            else
            {
                res.end(JSON.stringify("No Short Stories from User " + username + "found."))
            }
            });
        }
        else
        {
            res.json('User does not exist');
        }
    });


});

app.get('/shortStories/genre', (req, res) =>{

    var genre = req.query.genre;
    console.log(genre);
    db.query('SELECT * from short_stories WHERE shortGenre =?',[genre], function(err, result, fields){
        db.on('error', function(err){
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result[0]));
        }
        else
        {
            res.json('/Genres - Unable to retrieve short stories for '+genre+' at the moment.');
        }
    });
})



app.post("/upload",upload.single('profile'), (req, res) => {
  
    res.json({
        success:1,
        profile_url: `http://localhost:5000/cover/${req.file.filename}`
    })
      console.log(req.file)
  })


app.post('/shortStories', upload.single('cover'), (req, res, next) => {

    var post_data = req.body;

    // Extract data from the POST request
    var user_id = post_data.userID; 
    var shortTitle = post_data.shortTitle;
    var shortStory = post_data.shortStory;
    var shortGenre = post_data.shortGenre;
    var appCount = 0;
    var shortDescription = post_data.shortDescription;
    var coverImage = "http://localhost:5000/coverImage/"+req.file.filename

    db.query('SELECT * from users where user_id=?',[user_id], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length)
        {         
            //user_id = result[0].user_id;
            db.query('INSERT INTO `short_stories` (`user_id`, `shortTitle`, `shortStory`, `shortGenre`, `appCount`, `shortDescription`, `coverImage`) VALUES (?,?,?,?,?,?,?)', [user_id, shortTitle, shortStory, shortGenre, 0, shortDescription, coverImage], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Short Story Upload Error: ", error);
                });
                // res.json("Short Story has successfully been uploaded!");                
                res.json({
                    success:1,
                    profile_url: `http://localhost:5000/coverImage/${req.file.filename}`,
                    message: `Short Story has successfully been uploaded!`
                })
                  console.log(req.file)
            })          
        }
        else
        {
            res.json('User does not exist');
        }
    });
}) 


app.post("/shortStories/edit", upload.single('cover'), (req, res) => {
    var post_data = req.body;
    var shortID = post_data.shortID; 
    var shortTitle = post_data.shortTitle;
    var shortStory = post_data.shortStory;
    var shortGenre = post_data.shortGenre;
    var shortDescription = post_data.shortDescription;
    if (req.file.filename != null){
        var coverImage = "http://localhost:5000/coverImage/"+req.file.filename;
    }

    db.query("Select * from short_stories where shortID = ?", [shortID], function(error, result, fields){
        db.on('error',function(error){
            console.log('[MySQL Error', error);
        });
        if(result && result.length)
        {
            db.query('UPDATE short_stories SET shortTitle = ?, shortStory = ?, shortGenre = ?, shortDescription = ?, coverImage =  ? WHERE shortID = ?', [shortTitle, shortStory, shortGenre, shortDescription, coverImage, shortID], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Short Story Edit Error: ", error);
                });
                res.json("Short Story has successfully been edited!");                
                    console.log(req.file)
            })            
        }
        else
        {
            res.json("Short Story does not exist");
        }
    })
})


app.post("/stories/edit", upload.single('cover'), (req, res) => {
    var post_data = req.body;
    
    var story_id = post_data.story_id; 
    var story_title = post_data.story_title;
    var story_genre = post_data.story_genre;
    var story_description = post_data.story_description;
    if (req.file.filename != null){
        var coverImage = "http://localhost:5000/coverImage/"+req.file.filename;
    }

    db.query("Select * from stories where story_id = ?", [story_id], function(error, result, fields){
        db.on('error',function(error){
            console.log('[MySQL Error', error);
        });
        if(result && result.length)
        {
            db.query('UPDATE stories SET story_title = ?, story_description = ?, story_genre = ?, coverImage =  ? WHERE story_id = ?', [story_title, story_description, story_genre, coverImage, story_id], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Story Edit Error: ", error);
                });
                res.json("Story has successfully been edited!");                
                console.log(req.file);
            })            
        }
        else
        {
            res.json("Story does not exist");
        }
    })


})

// Unpublish stories.
app.get('/stories/unpublish', (req, res, next) => {

    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query('SELECT * from stories where story_id = '+story_id+' AND user_id = '+user_id, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {

            db.query('UPDATE stories SET story_status = 0 where story_id = '+story_id, function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
                    res.json('Story has been unpublished');
            });
        }
        else
        {
            res.json('Story does not exist');
        }
    });

}) 

// Publish Stories
app.get('/stories/publish', (req, res, next) => {

    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query('SELECT * from stories where story_id = '+story_id+' AND user_id = '+user_id, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {

            db.query('UPDATE stories SET story_status = 1 where story_id = '+story_id, function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
                    res.json('Story has been published');
            });
        }
        else
        {
            res.json('Story does not exist');
        }
    });

}) 

// Delete stories.
app.get('/stories/delete', (req, res, next) => {

    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query('SELECT * from stories where story_id = '+story_id+' AND user_id = '+user_id, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {

            db.query('DELETE from stories where story_id = '+story_id, function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
                    res.json('Story has been deleted');
            });
        }
        else
        {
            res.json('Story does not exist');
        }
    });

}) 

// Delete stories.
app.get('/shortStories/delete', (req, res, next) => {

    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query('SELECT * from short_stories where shortID = '+story_id+' AND user_id = '+user_id, function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length)
        {

            db.query('DELETE from short_stories where shortID = '+story_id, function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                });
                    res.json('Story has been deleted');
            });
        }
        else
        {
            res.json('Story does not exist');
        }
    });

}) 

app.post("/shortStories/comments", (req, res) => {

    var post_data = req.body;
    
    var story_id = post_data.story_id; 
    var user_id = post_data.user_id;
    var comment = post_data.comment;
    db.query("INSERT INTO comments (story_id, comment, user_id, story_type) VALUES ("+story_id+", '"+comment+"', " +user_id+",'short_story')", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL Short Story ERROR]', error);
            res.json("Comment Error: ", error);
        });
        res.json("Comment has successfully been uploaded!");                
    }) 
})


app.get('/shortStories/comments', (req, res) =>{
    var story_id = req.query.story_id;

    // db.query("SELECT comment_id, story_id, comment, comments.user_id, users.username from comments INNER JOIN users on comments.user_id = users.user_id where comments.story_id = "+story_id+" and comments.story_type = 'short_story'", function(error, result, fields){
        db.query("SELECT comment_id, story_id, comment, comments.user_id, users.username from comments INNER JOIN users on comments.user_id = users.user_id where comments.story_id = "+story_id+" and comments.story_type = 'short_story'", function(error, result, fields){

        db.on('error', function(error){
            console.log("MySQL Comment Error")
        });

        res.send(JSON.stringify(result));

    })
})


app.post("/stories/comments", (req, res) => {

    var post_data = req.body;
    
    var story_id = post_data.story_id; 
    var user_id = post_data.user_id;
    var comment = post_data.comment;
    db.query("INSERT INTO comments (story_id, comment, user_id, story_type) VALUES ("+story_id+", '"+comment+"', " +user_id+",'story')", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL Short Story ERROR]', error);
            res.json("Comment Error: ", error);
        });
        res.json("Comment has successfully been uploaded!");                
    }) 
})


app.get('/stories/comments', (req, res) =>{
    var story_id = req.query.story_id;

    // db.query("SELECT comment_id, story_id, comment, comments.user_id, users.username from comments INNER JOIN users on comments.user_id = users.user_id where comments.story_id = "+story_id+" and comments.story_type = 'short_story'", function(error, result, fields){
        db.query("SELECT comment_id, story_id, comment, comments.user_id, users.username from comments INNER JOIN users on comments.user_id = users.user_id where comments.story_id = "+story_id+" and comments.story_type = 'story'", function(error, result, fields){

        db.on('error', function(error){
            console.log("MySQL Comment Error")
        });

        res.send(JSON.stringify(result));

    })
})


app.post("/upload",upload.single('profile'), (req, res) => {
  
  res.json({
      success:1,
      profile_url: `http://localhost:5000/profile/${req.file.filename}`
  })
    console.log(req.file)
})

// Like the short story
app.post('/shortStories/like', (req, res, next) =>{
    var shortID = req.body.shortID;
    var userID = req.body.userID;

    
    db.query("Select * from likes where user_id = " + userID + " AND story_id = " + shortID + " AND story_type = 'short_story' AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MysSQL ERROR]', error);
        });
        if(result && result.length){
            res.json("You have already liked the story!");
        }
        else {
            db.query("Select * from likes where user_id = " + userID + " AND story_id = " + shortID + " AND story_type = 'short_story'", function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MysSQL ERROR]', error);
                });
        
                if ( result && result.length)
                {
                    db.query("UPDATE likes SET status = 1 WHERE user_id = " + userID + " AND story_id = " + shortID + " AND story_type = 'short_story'", function(error, result, fields){
                        db.on('error', function(error){
                            console.log('[MySQL Error', error);
                            res.json('[MySQL Error', error);
                        });
                        res.json("Short Story has been liked");     
                    })   
                }
                else
                {
                    db.query("INSERT INTO `likes` (user_id, status, story_id, story_type) VALUES ("+ userID +", 1, "+ shortID +", 'short_story')", function(error, result, fields){
                        db.on('error', function(error){
                            res.json('[MySQL Error', error);
                        });
                        res.json("Short Story has been liked");     
                    })        
                }
                db.query('UPDATE short_stories SET appCount = appCount + 1 where shortID = ' + shortID, function(error, result, fields){
                    db.on('error', function(error){
                        console.log('[MySQL ERROR]', error);
                        // res.json("Error occured:", error);
                    });
                })
            })
        }
    })
})


//Unlike the short story
app.post('/shortStories/unlike', (req, res, next) =>{
    var shortID = req.body.shortID;
    var userID = req.body.userID;

    db.query("Select * from likes where user_id = " + userID + " AND story_id = " + shortID + " AND story_type = 'short_story' AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MysSQL ERROR]', error);
        });
        if ( result && result.length)
        {
            db.query("UPDATE likes SET status = 0 WHERE user_id = " + userID + " AND story_id = " + shortID + " AND story_type = 'short_story'", function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Error', error);
                    res.json('[MySQL Error', error);
                });

                db.query('UPDATE short_stories SET appCount = appCount - 1 where shortID = ' + shortID + ' AND appCount > 0', function(error, result, fields){
                    db.on('error', function(error){
                        console.log('[MySQL ERROR]', error);
                        // res.json("Error occured:", error);
                    });
                })
            
                res.json("Short Story has been unliked");     
            })   
        }
        else{
            res.json("Short Story has already been unliked");
        }
    })
})

// Check whether the short story has been liked or not
app.get('/shortStories/like', (req, res, next) =>{
    var userID = req.query.userID;
    var shortID = req.query.shortID;
    db.query("Select * from likes WHERE user_id = " +userID + " AND story_id = " + shortID + " AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('error', error);
        })
        if(result && result.length){
            res.json("User has liked the story")
        }
        else
        {
            res.json("User hasn't liked the story");
        }

    })
})




// Like the story
app.post('/stories/like', (req, res, next) =>{
    var story_id = req.body.story_id;
    var user_id = req.body.user_id;

    db.query("Select * from likes where user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 'story' AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MysSQL ERROR]', error);
        });
        if(result && result.length){
            res.json("You have already liked the story!");
        }
        else {
            db.query("Select * from likes where user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 'story'", function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MysSQL ERROR]', error);
                });
        
                if ( result && result.length)
                {
                    db.query("UPDATE likes SET status = 1 WHERE user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 'story'", function(error, result, fields){
                        db.on('error', function(error){
                            console.log('[MySQL Error', error);
                            res.json('[MySQL Error', error);
                        });
                        res.json("Story has been liked");     
                    })   
                }
                else
                {
                    db.query("INSERT INTO `likes` (user_id, status, story_id, story_type) VALUES ("+ user_id +", 1, "+ story_id +", 'story')", function(error, result, fields){
                        db.on('error', function(error){
                            res.json('[MySQL Error', error);
                        });
                        res.json("Story has been liked");     
                    })        
                }
                db.query('UPDATE stories SET likes = likes + 1 where story_id = ' + story_id, function(error, result, fields){
                    db.on('error', function(error){
                        console.log('[MySQL ERROR]', error);
                        // res.json("Error occured:", error);
                    });
                })
            })
        }
    })
})


//Unlike the short story
app.post('/stories/unlike', (req, res, next) =>{
    var story_id = req.body.story_id;
    var user_id = req.body.user_id;

    db.query("Select * from likes where user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 'story' AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('[MysSQL ERROR]', error);
        });
        if ( result && result.length)
        {
            db.query("UPDATE likes SET status = 0 WHERE user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 'story'", function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Error', error);
                    res.json('[MySQL Error', error);
                });

                db.query('UPDATE stories SET likes = likes - 1 where story_id = ' + story_id + ' AND likes > 0', function(error, result, fields){
                    db.on('error', function(error){
                        console.log('[MySQL ERROR]', error);
                        // res.json("Error occured:", error);
                    });
                })
            
                res.json("Story has been unliked");     
            })   
        }
        else{
            res.json("Story has already been unliked");
        }
    })
})

// Check whether the story has been liked or not
app.get('/stories/like', (req, res, next) =>{
    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query("Select * from likes WHERE user_id = " +user_id + " AND story_id = " + story_id + " AND status = 1", function(error, result, fields){
        db.on('error', function(error){
            console.log('error', error);
        })
        if(result && result.length){
            res.json("User has liked the story")
        }
        else
        {
            res.json("User hasn't liked the story");
        }

    })
})


app.post('/stories', upload.single('cover'), (req, res, next) => {

    var post_data = req.body;

    // Extract data from the POST request
    var user_id = post_data.userID; 
    var storyTitle = post_data.storyTitle;
    var storyGenre = post_data.storyGenre;
    var likes = 0;
    var storyDescription = post_data.storyDescription;
    var coverImage = "http://localhost:5000/coverImage/"+req.file.filename;

    var story_id;
    var chapter_name = post_data.chapter_name;
    var chapter_text = post_data.chapter_text;


    db.query('SELECT * from users where user_id=?',[user_id], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length)
        {         
            //user_id = result[0].user_id;                                                                                                              `user_id`, `story_title`, `story_description`, `story_genre`, `story_status`, `likes`, `coverImage`
            db.query('INSERT INTO `stories` (`user_id`, `story_title`, `story_description`, `story_genre`, `story_status`, `likes`, `coverImage`) VALUES (?,?,?,?,?,?,?)', [user_id, storyTitle, storyDescription, storyGenre, 1, 0, coverImage], function(error, result, fields){

                story_id = result.insertId;
                console.log("Story_id" + story_id);
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Story Upload Error: ", error);
                });

                db.query('INSERT INTO `storyChapters` (`story_id`, `chapter_name`, `chapter_text`, `status`) VALUES (?,?,?,?)', [story_id, chapter_name, chapter_text, 1], function(error, result, fields){
                    console.log("Story_id" + story_id);
                    db.on('error', function(error){
                        console.log('[MySQL Short Story ERROR]', error);
                        res.json("Chapter Upload Error: ", error);
                    });

                res.json("Story has successfully been uploaded!");                
                  console.log(req.file);
                })      
            })          
        }
        else
        {
            res.json('User does not exist');
        }   
    });
}) 

app.post('/stories/chapters', (req, res, next) => {

    var post_data = req.body;

    // Extract data from the POST request
    var story_id = post_data.story_id;
    var chapter_name = post_data.chapter_name;
    var chapter_text = post_data.chapter_text;


    db.query('SELECT * from stories where story_id =?',[story_id], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length)
        {         
            db.query('INSERT INTO `storyChapters` (`story_id`, `chapter_name`, `chapter_text`, `status`) VALUES (?,?,?,?)', [story_id, chapter_name, chapter_text, 1], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Chapter Upload Error: ", error);
                });

            res.json("Chapter has successfully been uploaded!");                
            })      
        }
        else
        {
            res.json('Story does not exist');
        }   
    });
}) 


// Edit Chapters from stories
app.post('/stories/chapters/edit', (req, res, next) => {

    var post_data = req.body;

    // Extract data from the POST request
    var chapter_id = post_data.chapter_id;
    var chapter_name = post_data.chapter_name;
    var chapter_text = post_data.chapter_text;

    db.query('SELECT * from storychapters where chapter_id = ' + chapter_id , function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
        if ( result && result.length)
        {         
            db.query('UPDATE storychapters SET chapter_name = "' + chapter_name + '", chapter_text="' + chapter_text + '" WHERE chapter_id = '+ chapter_id, function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL Short Story ERROR]', error);
                    res.json("Chapter Upload Error: ", error);
                });

            res.json("Chapter has successfully been edited!");                
            })      
        }
        else
        {
            res.json('Chapter does not exist');
        }   
    });
}) 



app.get('/shortStories/readingList', (req, res, next) =>{
var userID = 0;
userID = req.query.userID;

var queryString = "SELECT short_stories.shortID, short_stories.shortTitle, short_stories.shortStory, short_stories.shortGenre, short_stories.appCount, short_stories.shortDescription, short_stories.coverImage, users.username from short_stories INNER JOIN users on short_stories.user_id = users.user_id  INNER JOIN reading_list on reading_list.story_id = short_stories.shortID where reading_list.user_id = "+ userID+ " AND reading_list.story_type = 1";

    db.query("Select * from reading_list where reading_list.user_id = "+ userID, function(error, result, field){
        db.on('error', function(error){
            console.log('MySQL Error', error);
        });

        if(result && result.length)
        {
            db.query(queryString, function(err, result, fields){
                db.on('error', function(err){
                    console.log('[MySQL ERROR]', err);
                });
        
                if ( result && result.length)
                {            
                        res.send(JSON.stringify(result));
                }
                else
                {
                    res.json('Unable to retrieve short stories at the moment.');
                }
            });

        }
        else
        {
            res.json('Unable to retrieve short stories at the moment.');
        }

    });

});


app.get('/shortStories/readingList/remove', (req, res, next) =>{
    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query("Select * from reading_list where user_id = "+ user_id +" AND story_id = "+ story_id+" AND story_type = 1", function(error, result, field){
        db.on('error', function(error){
            console.log('MySQL Error', error);
        });
        if(result && result.length)
        {
            var reading_id = result[0].reading_id;
            db.query("Delete from reading_list where reading_id = "+ reading_id, function(err, result, fields){
                db.on('error', function(err){
                    console.log('[MySQL ERROR]', err);
                });
                res.json('Short Story has been removed from the reading list');

            });

        }
        else
        {
            res.json('Short Story does not exist in reading list!');
        }

    });

});
    

app.post('/shortStories/readingList', (req, res, next) =>{

    var post_data = req.body;
    var user_id = post_data.user_id;
    var story_id = post_data.story_id;

    var queryString = "Insert into reading_list (user_id, story_id, story_type) VALUES (" + user_id + ", " + story_id + ", 1)";

    db.query("Select * from reading_list WHERE user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 1", function(err, result, fields){
        if(result && result.length)
        {
            res.json("Short Story already exists in reading list.");
        }
        else
        {
            db.query(queryString, function(err, result, fields){
                res.json("Short Story successfully added to reading list.")
                db.on('error', function(err){ 
                    console.log('[MySQL ERROR]', err);
        
                });
            });
        }

    })

});


app.get('/stories/readingList', (req, res, next) =>{

    var userID = req.query.userID;

    var queryString = "SELECT stories.story_id, stories.story_title, stories.story_description, stories.story_genre, stories.story_status, stories.likes, stories.readings, stories.chapters, stories.coverImage, users.username from stories INNER JOIN users on stories.user_id = users.user_id INNER JOIN reading_list on reading_list.story_id = stories.story_id where reading_list.user_id = " + userID + " AND reading_list.story_type = 0";

    db.query(queryString, function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('Unable to retrieve stories at the moment.');
        }
    });
});

// Remove Story from user's reading list.
app.get('/stories/readingList/remove', (req, res, next) =>{
    var user_id = req.query.user_id;
    var story_id = req.query.story_id;

    db.query("Select * from reading_list where user_id = "+ user_id +" AND story_id = "+ story_id+" AND story_type = 0", function(error, result, field){
        db.on('error', function(error){
            console.log('MySQL Error', error);
        });
        if(result && result.length)
        {
            var reading_id = result[0].reading_id;
            db.query("Delete from reading_list where reading_id = "+ reading_id, function(err, result, fields){
                db.on('error', function(err){
                    console.log('[MySQL ERROR]', err);
                });
                res.json('Story has been removed from the reading list');

            });

        }
        else
        {
            res.json('Story does not exist in reading list!');
        }

    });

});

app.post('/stories/readingList', (req, res, next) =>{

    var post_data = req.body;
    var user_id = post_data.user_id;
    var story_id = post_data.story_id;

    var queryString = "Insert into reading_list (user_id, story_id, story_type) VALUES (" + user_id + ", " + story_id + ", 0)";


    db.query("Select * from reading_list WHERE user_id = " + user_id + " AND story_id = " + story_id + " AND story_type = 0", function(err, result, fields){
        if(result && result.length)
        {
            res.json("Story already exists in reading list.");
        }
        else
        {
            db.query(queryString, function(err, result, fields){
                res.json("Story successfully added to reading list.")
                db.on('error', function(err){ 
                    console.log('[MySQL ERROR]', err);
                });
            });
        }

    });

});


app.post('/journals',(req, res, next) => {
    var post_data = req.body; //Get POST params

    var journal_title = post_data.journal_title;
    var journal = post_data.journal;
    var userID = post_data.userID;
    
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; 
    var yyyy = today.getFullYear();
    if(dd<10) 
    {
        dd='0'+dd;
    } 
    
    if(mm<10) 
    {
        mm='0'+mm;
    } 
    today = dd+'-'+mm+'-'+yyyy;

    db.query('SELECT * from users where user_id =?',[userID], function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });

        if ( result && result.length<1)
        {
            res.json('User does not exist!');
        }
        else{
            db.query('INSERT INTO `journals`(`journal_title`, `journal_date`, `journal`, `user_id`) VALUES (?,?,?,?)', [journal_title, today, journal, userID], function(error, result, fields){
                db.on('error', function(error){
                    console.log('[MySQL ERROR]', error);
                    res.json("Journal Upload Error: ", error);
                });
                res.json("Journal Uploaded Successfully!");     
            })
        }
         
    });
})

app.get('/journals', (req, res, next) =>{

    var userID = parseInt(req.query.userID);

    db.query('SELECT * from journals where user_id =?', [userID], function(err, result, fields){
        db.on('error', function(err){ 
            console.log('[MySQL ERROR]', err);
        });

        if ( result && result.length)
        {            
                res.send(JSON.stringify(result));
        }
        else
        {
            res.json('No Journals found!');
        }
    });
});

// Post reports
app.post('/report', (req, res, next) => {
    var post_data = req.body;
    // Extract data from the POST request
    var story_id = post_data.story_id;
    var reporter = post_data.reporter;
    var report_reason = post_data.report_reason;
    var story_type = post_data.story_type;

    db.query('INSERT INTO `reports`(`book_id`, `reporti`, `report_reason`, `story_type`) VALUES (?,?,?,?)', [story_id, reporter, report_reason, story_type] , function(error, result, fields){
        db.on('error', function(error){
            console.log('[MySQL ERROR]', error);
        });
            res.json('Report submitted successfully');
    });
})

function errHandler(err, req, res, next){
    if(err instanceof multer.MulterError){
        res.json({
            success:0,
            message: err.message
        })
    }
}

app.use(errHandler)

app.listen(5000, () =>{
    console.log("Server started on Port 5000")
})