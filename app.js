var PubNub = require('pubnub');
var RiveScript = require("./lib/rivescript.js");
var request = require('request');
var db = require('diskdb');
db = db.connect('./db', ['data','log']);
var config = require('./config');
// Create the bot.
var bot = new RiveScript();
bot.setSubroutine('myFunction', function(rs, args){
        return "Ejecuto!"
});

//Accents
function accents(text) {
    var dict = {"á":"a", "é":"e", "í":"i", "ó":"o", "ú":"u", "?":" ", "¿":" ", ".":" ", ",":" ", ";":" "     }

    text = text.replace(/[^\w ]/g, function(char) {
        var val = dict[char] || char;
        return val;
    });
    return text;
}

bot.loadDirectory("./SofIA_Brain", success_handler, error_handler);

function success_handler (loadcount) {
	console.log("Load #" + loadcount + " completed!");
	bot.sortReplies();
    //var data = bot.deparse();
    //db.botdata.save(data);
    InitPubNub();
}

function error_handler (loadcount, err) {
	console.log("Error loading batch #" + loadcount + ": " + err + "\n");
}

function InitPubNub(){
    var uuid = 'user-'+config.user_id;
    var userChannelName = uuid + '-present';
    var organizationChannelName = 'organization-154';
    
    pubnub = new PubNub({
        publishKey : config.publishKey ,
        subscribeKey : config.subscribeKey,
        heartbeat: 15,
        uuid: uuid,
        authKey: config.authKey,
        ssl: true,
        restore: true,
    })
        

    pubnub.addListener({
        status: function(statusEvent) {
            if (statusEvent.category === "PNConnectedCategory") {
                //Estoy Conectado
                console.log("Conectado!");
            }
        },
        message: function(message) {
            console.log("->> Tipo =" + message.message.namespace);
            console.log("->> Destinatarios =" + JSON.stringify(message.message.recipients));
            //console.log("->> Data =" + JSON.stringify(message.message.data));
            //notifications.create y messages.create se ejecutan juntos cuando cierro la ventana  "content":"closed","type":"SYSTEM"

            switch (message.message.namespace) {
                case 'notifications.create':
                    //es una notificacion que se ejecuta antes de un evento messages.create generalmente lo veo con "event_name":"messages.create"
                    //{"context_id":24879,"context_type":"Conversation","created_at":"2017-01-31T17:43:34Z","event_name":"messages.create","id":945159,"payload":{"readable_subject":"bci test","readable_target":"Hola",
                    //"subject_avatar":"https://s3.amazonaws.com/prod.letsta.lk/users/avatars/4147567feab2942a349bdbf674d6ae1a84886015/thumb.jpg?1485809722","link_to":{"resource_class":"Conversation","resource_id":24879},
                    //"message":"page: https://bci-test.letsta.lk/examples/widget\nvisits: 5\nplatform: widget\nempresa: no-pyme","conversation_type_name":"normal"},
                    //"person_id":3970,"person_type":"User","read":false,"subject_id":3969,"subject_type":"User","target_id":314509,"target_type":"Message","updated_at":"2017-01-31T17:43:34Z"}
                    break;
                case 'notifications.update':
                   
                    break;
                case 'messages.create':
                    //Cuando cierro ventana llega "content":"closed","type":"SYSTEM" luego ejecuta conversations.update

                    //Cuando recibo mensaje llega "type":"NORMAL", "content_type":"text/plain" "content" con el texto
                    //"person":{"id":107510,"name":"Pepe","avatar":"https://api.letsta.lk/assets/default-avatar.gif","type":"Client","email":"pepe@gmail.com"
                    console.log(message.message.data.type);
                    console.log(message.message.data.content_type);
                    console.log(message.message.data.person.id);
                    if(message.message.data.type==="NORMAL" && message.message.data.content_type==="text/plain" && message.message.data.person.id !== config.user_id){
                        //Tengo que setear las variables con información
                        var msg = accents(message.message.data.content)

                        var respuesta = bot.reply(message.message.data.person.id,msg , this);
                        var log = {
                            person:message.message.data.person,
                            msgin:message.message.data.content,
                            msgout:respuesta,
                            date: new Date()
                        };
                        db.log.save(log);
                        if(respuesta === 'Unknown'){
                            db.data.save(log);
                            respuesta = 'Disculpa, no te he entendido.';
                        }
                        var formData = {"conversation_id":message.message.data.conversation_id,"content_type":"text/plain","content":respuesta,"remote_id":"088ad22c-b978-993c-c44c-bd0ea327d2ec","internal":false}
                        var options = {
                            url: 'https://bci-test.letsta.lk/api/v1/conversations/'+message.message.data.conversation_id+'/messages',
                            method: 'POST',
                            headers: {
                                'Authorization': 'Basic bnRyWFJEQnpWRnZtZ3hRNkJvOXA6WA=='
                            },
                            json: formData
                        };
                        request.post(options, function optionalCallback(err, httpResponse, body) {
                            if (err) {
                                return console.error('failed:', err);
                            }
                            console.log('Send successful!  Server responded with:', body);
                        });
                    }
                    break;
                case 'person_statuses.update':
                    //Es Continuo
                    //->> Data ={"person_type":"Client","person_id":107510,"status_name":"offline","status":0,"is_present":true,"updated_at":"2017-01-31T17:59:20.000+0000"}
                    break;
                case 'typing.now':
                    //Esta escribiendo
                    break;
                case 'conversation_memberships.update':
                   
                    break;
                case 'conversations.update':
                   // Cuando se cierra una conversacion me llega al final conversations.update con "status":"Closed"
                    break;
                    
            }
        },
        presence: function(presenceEvent) {
            console.log("Presence : ", presenceEvent);
        }
    })      
    console.log("Subscribing..");
    pubnub.subscribe({
        channels: [organizationChannelName],
        connect : function(){
            console.log("Connected")
        },
        disconnect : function(){
            console.log("Disconnected")
        },
        reconnect : function(){
            console.log("Reconnected")
        },
        error : function(){
            console.log("Network Error")
        }, 
    });
}