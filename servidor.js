var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");
var weather = require("weather-js");
// var nodemailer = require("nodemailer");

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

// Umbrales de los sensores
var TEMP_MAX = "100";
var TEMP_MIN = "0";
var LUM_MAX = "100";
var LUM_MIN = "10";

var tmax="20";
var tmin="20";
var lmax="20";
var lmin="20";
//
// Array para mostrar cambios en el cuadro de cambios en el usuario
var log = [];
var firstTime = true;

// Valores de los actuadores
// Apagado/Cerrada == false
// Encendido/Abierta == true
var persiana = false;
var aire_acondicionado = false;
//

function agente_sistema(){
	let t = Date.now()

	// Administramos temperatura
	if (parseInt(tmax) >= parseInt(TEMP_MAX)){
		aire_acondicionado = true;
		tmax = "27";
		log.push(t + ": Se ha encendido el aire acondicionado. Que calor hace!!!");
		log.push("Temperatura actual: 27ºC");
	} else if(parseInt(tmin) <= parseInt(TEMP_MIN)){
		aire_acondicionado = false;
		tmin = "5";
		log.push(t + ": Apagando el aire acondicionado, que hace fresquete");
	}

	// Administramos luminosidad
	if (parseInt(lmax) >= parseInt(LUM_MAX)){
		persiana = false;
		lmax = "80";
		log.push(t + ": Demasiada luz, cerrando la persiana");
	} else if(parseInt(lmin) <= parseInt(LUM_MIN)){
		persiana = true;
		lmin = "20"
		log.push(t + ": Abriendo la persiana, que esto parece una cueva");
	}
}

var httpServer = http.createServer(
	function(request, response) {
		var uri = url.parse(request.url).pathname;
		if (uri=="/sensor") uri = "/sensor.html"
		else if (uri=="/usuario") uri = "/usuario.html";
		else if (uri=="/") uri = "usuario.html";
		var fname = path.join(process.cwd(), uri);
		fs.exists(fname, function(exists) {
			if (exists) {
				fs.readFile(fname, function(err, data){
					if (!err) {
						var extension = path.extname(fname).split(".")[1];
						var mimeType = mimeTypes[extension];
						response.writeHead(200, mimeType);
						response.write(data);
						response.end();
					}
					else {
						response.writeHead(200, {"Content-Type": "text/plain"});
						response.write('Error de lectura en el fichero: '+uri);
						response.end();
					}
				});
			}
			else{
				console.log("Peticion invalida: "+uri);
				response.writeHead(200, {"Content-Type": "text/plain"});
				response.write('404 Not Found\n');
				response.end();
			}
		});
	}
);


httpServer.listen(8000);
var io = socketio(httpServer);

weather.find(
	{
		search: 'Priego de Córdoba, España',
		degreeType: 'C'
	}, 
	function(err,result){
		if(err) console.log(err);
		// console.log(JSON.stringify(result,null,2));
		console.log(result);
	}
);

MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true, useUnifiedTopology: true}, function(err, db) {
	var dbo = db.db("pruebaBaseDatos");
	var datos = [];
	
	// filtro pa ver si existe la BD 
	
	//

	dbo.collection("datos_sensores", function(err, collection){
		
		io.sockets.on('connection', function(client) {
			recogerDatos();
			
			// if(datos.length == 0 && firstTime){
			// 	collection.insertOne({
			// 		"Tipo": "temperatura",
			// 		'tmin': tmin,
			// 		'tmax': tmax
			// 	});
			// 	collection.insertOne({
			// 		"Tipo": "luminosidad",
			// 		'lmin': lmin,
			// 		'lmax': lmax
			// 	});
			// 	collection.insertOne({
			// 		"Tipo": "actuadores",
			// 		'persiana': persiana,
			// 		'aire_acondicionado': aire_acondicionado
			// 	});
			// 	firstTime = false;
			// }
			io.emit('obtener',datos);
			
			// Actualizar valores de temperatura
			client.on('nueva_temperatura', function(data){
				tmax =data.tmax;
				tmin =data.tmin;

				// collection.updateOne({"Tipo": "temperatura"},
				// {
				// 	$set: {
				// 			'tmin': data.tmin,
				// 			'tmax': data.tmax
				// 		  }
				// });
				let t = Date.now()
				log.push(t + ": Se ha actualizado la temperatura a " + tmax + "ºC");
				
				actualizar();
			});

			// Actualizar valores de luminosidad
			client.on('nueva_luminosidad', function(data){
				lmax =data.lmax;
				lmin =data.lmin;

				// collection.updateOne({"Tipo": "luminosidad"},
				// {
				// 	$set: {
				// 			'lmin': data.lmin,
				// 			'lmax': data.lmax
				// 		  }
				// });
				let t = Date.now()
				log.push(t + ": Se ha actualizado la luminosidad a " + lmax + "%");
				
				actualizar();
			});

			// Actualizar valores de los actuadores
			client.on('actualizarActuadores', function(data){
				persiana = data.persiana;
				aire_acondicionado = data.aire;

				// collection.updateOne({"Tipo": "actuadores"},
				// {
				// 	$set: {
				// 			'persiana': persiana,
				// 			'aire_acondicionado': aire_acondicionado
				// 		  }
				// });
				actualizar();
				let t = Date.now()
				log.push(t + ": Se ha actualizado el estado de los actuadores");
			});

			client.on('log',function(logs){
				var data = log;
				io.emit('log',data);
			})

			// Recoger datos de la BD
			function recogerDatos(){
				var res = false;; 

				collection.find().toArray(function(err, results){
					// Asignamos datos
					datos = results;
					io.emit('obtener', datos);

					for(let i=0; i<results.length; i++){
						if (results[i].Tipo == "temperatura") {
							tmax = results[i].tmax;
							tmin = results[i].tmin;
						} else if (results[i].Tipo == "luminosidad") {
							lmax = results[i].lmax;
							lmin = results[i].lmin;
						} else if (results[i].Tipo == "actuadores"){
							persiana = results[i].persiana
							aire_acondicionado = results[i].aire_acondicionado;
						}
					}
				});
				
			}

			// Actualizar valores en la BD y en el cliente
			function actualizar(){
				agente_sistema();
				asignarVariables();
				recogerDatos();

				io.emit('obtener', datos);				
				io.emit('log',log);
			}

			// Actualizamos en la base de datos con todos los valores actualizados
			// una vez pasados por el agente del sistema
			function asignarVariables(){
				// Temperatura
				collection.updateOne({"Tipo": "temperatura"},
				{
					$set: {
							'tmin': tmin,
							'tmax': tmax
						  }
				});

				// Luminosidad
				collection.updateOne({"Tipo": "luminosidad"},
				{
					$set: {
							'lmin': lmin,
							'lmax': lmax
						  }
				});

				// Actuadores
				collection.updateOne({"Tipo": "actuadores"},
				{
					$set: {
							'persiana': persiana,
							'aire_acondicionado': aire_acondicionado
						  }
				});
			}

			// var transporter = nodemailer.createTransport({
			// 	service: 'gmail',
			// 	auth: {
			// 		user: "agenteDomoticaP4@gmail.com",
			// 		pass: 'holahola1!'
			// 	}
			// });

			// var mailOptions = {
			// 	from: 'agenteDomoticaP4@gmail.com',
			// 	to: 'agumeri003@hotmail.com',
			// 	subject: 'Enviando mensaje de prueba.',
			// 	text: 'AAAAAAA POS MIRA, HA SERVIDO JEJEJEJE'
			// };

			// client.on('enviar_mensaje',function(mensaje){
			// 	transporter.sendMail(mailOptions,function(error,info){
			// 		if(error){
			// 			console.log(error);
			// 		}else{
			// 			console.log("Email sent: " + info.response);
			// 		}
			// 	});
			// });

		});
    });
});

console.log("Servicio MongoDB iniciado");
console.log("Servidor escuchando en el puerto 8000");
console.log("\nRutas disponibles")
console.log("Sensor --> localhost:8000/sensor");
console.log("Usuario --> localhost:8000/usuario");

