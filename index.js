const express = require('express');
const axios = require('axios').default;
var mysql = require('mysql');
var moment = require('moment');
const app = express();
app.use(express.json())
const port = process.env.PORT || 4000;

const fs = require('fs');
const { response } = require('express');

//Checking token is expired or not
_access_token = 'EAARsTYqMmk4BAHtom7LTVk05CnmIrbTblCVTvfDZCwUbB5R4oSEZCZBpsd3hjfsOnhPKDybHOh115X4xKa0JoADPqWYJEGzgBXEsp8pN4FgZCMMhvYSrDBey99g6l7615AuSpVSbVc3uOlwEiw2EEOajxFf2gNa5GUVuAoCkSX3ZAoWz3LLlhxNGZADNEycQiKvypalGA2lVgMPa3pGMZBQ';
let tokenExpired = false;
let url = `https://graph.facebook.com/v14.0/me/accounts?access_token=${_access_token}`;
const getAccountsInfo = async () => {
    try {
        const resp = await axios.get(url);
        console.log("token working")
    } catch (err) {
        console.log("token expired")
        tokenExpired = true;
    }
};
getAccountsInfo();

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root"
});
  
con.connect(function(err) {
if (err) throw err;
console.log("DB Connected!");
});

  
app.get('/', (req, response) => {
    response.send("Hello from node server")
});

//adding post for publish
app.post('/schedule-post', (req, response) => {
    if(tokenExpired) response.send("token expired! Please regenerate the token")
    if(!moment(req.body.date_time, 'YYYY-MM-DD HH:mm:ss', true).isValid()){
        response.send("Please add date and time as: YYYY-MM-DD HH:mm:ss")
    }

    if(req.body.media_type != undefined && req.body.media_type == 'IMAGE'){
        delete req.body.video_url
    }else{
        delete req.body.image_url
    }
    
    let givenDate = moment(req.body.date_time).format('YYYY-MM-DD HH:mm:ss');
    console.log(req.body)

    let url = `https://graph.facebook.com/v14.0/17841454603070481/media?access_token=${_access_token}`;

    const addMedia = async () => {
        try {
            
            const resp = await axios.post(url, req.body);
            if(resp.data.id != undefined){
                var sql = "INSERT INTO teksavant.media_details (creation_id, time_to_publish) VALUES ( '"+resp.data.id+"', '"+givenDate+"')";
                con.query(sql, function (err, result) {
                    if (err) throw err;
                    console.log("1 record inserted");
                    con.commit();
                    response.send("Congratulations! your post is added in media")
                });
            }
            console.log(resp.data.id);
            console.log("resp");
        } catch (err) {
            // Handle Error Here
            response.send("Error! Please check inputs")
        }
    };
    addMedia();
});



//Checking daily limit of medias is exceeded or not
const checkLimit = async () => {
    let url = `https://graph.facebook.com/v14.0/17841454603070481/content_publishing_limit?access_token=${_access_token}`;
    try {
        const resp = await axios.get(url,  {"fields":"quota_usage,config","limit":"10"});
        console.log('quota_usage  '+resp.data.data[0].quota_usage);
        if(resp.data.data[0].quota_usage != undefined && resp.data.data[0].quota_usage > 25 ){
            return false
        }
        return true
    } catch (err) {
        return false;
    }
};

//Publishing valid medias
const publishMedia = async (creation_id) => {
    let url = `https://graph.facebook.com/v14.0/17841454603070481/media_publish?access_token=${_access_token}`;
    try {
        console.log('creation_id-'+creation_id)
        const resp = await axios.post(url,  { "creation_id": creation_id  });
        console.log('id-'+resp.data.id)
        if(resp.data.id != undefined){
            var sql = "UPDATE teksavant.media_details SET published = 1 WHERE creation_id = "+creation_id;
            con.query(sql, function (err, re) {
                if (err) throw err;
                console.log(re.affectedRows + " record(s) updated");
                con.commit();
            });
        }else{
            return false
        }
        return true
    } catch (err) {
        return false
    }
};

//post request for publishing medias.
app.post('/post-job', async (req, res) => {
    if(tokenExpired) response.send("token expired! Please regenerate the token")
    
    let limit = checkLimit()
    limit.then(function(result) {
        if(result){
            var curr_timestamp = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
            con.query("SELECT * FROM teksavant.media_details WHERE published = 0", function (err, result, fields) {
                if (err) throw err;
                console.log("result-");
                console.log(result);
                
                let published = false
                result.forEach(res => {
                    let res_timeStamp = moment(res.time_to_publish).format('YYYY-MM-DD HH:mm:ss');
                    if(res_timeStamp<curr_timestamp){
                        try{
                            if(!publishMedia(res.creation_id)){
                                res.send("Failed to published")
                            }
                            published = true
                        }catch(err){
                            published = false
                        }
                    }
                });

                if(published){
                    res.send("Congratulations! posts are published")
                }else{
                    res.send("There are no valid posts for published")
                }
            });
        }else{
            res.send("Error! Daily posts limit is exceeded")
        }
     }).catch((err) => {
        res.send("Error! Please contact IT Team")
    });
});

app.listen(port,()=>{
    console.log(`express server is running ${port}`)
})