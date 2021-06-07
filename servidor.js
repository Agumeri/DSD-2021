var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");
var weather = require("weather-js");
// var nodemailer = require("nodemailer");

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
const { SSL_OP_COOKIE_EXCHANGE } = require("constants");
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

// Umbrales de los sensores
var TEMP_MAX = "100";
var TEMP_MIN = "0";
var LUM_MAX = "100";
var LUM_MIN = "10";

// Valores de los actuadores
// Apagado/Cerrada == false
// Encendido/Abierta == true
var persiana = false;
var aire_acondicionado = false;
//

// Variables del servidor
var tmax="20";
var tmin="20";
var lmax="20";
var lmin="20";

// Array para mostrar cambios en el cuadro de cambios en el usuario
var log = [];


function agente_sistema(){
	var dia = new Date();
    var t = "[" + dia.getDate() + "/" + dia.getMonth() + " | " + dia.getHours() + ":" + dia.getMinutes() + ":" + dia.getSeconds() + "] --> ";
	
	// Administramos temperatura
	if (parseInt(tmax) >= parseInt(TEMP_MAX)){
		aire_acondicionado = true;
		tmax = "27";
		tmin = "7";

		let l = t + "Se ha encendido el aire acondicionado. Que calor hace!!!. La temperatura maxima pasa a ser de 27ºC y la minima 7ºC";
		log.push(l);
		console.log(l);

	} else if(parseInt(tmin) <= parseInt(TEMP_MIN)){
		aire_acondicionado = false;
		tmax = "30";
		tmin = "10";


		let l = t + "Apagando el aire acondicionado, que hace fresquete. La temperatura maxima pasa a ser de 30ºC y minima 10ºC ";
		log.push(l);
		console.log(l);
	}

	// Administramos luminosidad
	if (parseInt(lmax) >= parseInt(LUM_MAX)){
		persiana = false;
		lmax = "80";
		lmin = "50";

		let l = t + "Demasiada luz, cerrando la persiana. La luminosidad maxima es ahora del 80% y la minima del 50%;";
		log.push(l);
		console.log(l);
	} else if(parseInt(lmin) <= parseInt(LUM_MIN)){
		persiana = true;
		lmax = "50";
		lmin = "20"

		let l = t + "Abriendo las persianas, que esto parece una cueva. La luminosidad maxima es ahora del 50% y la minima del 20%";
		log.push(l);
		console.log(l);
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

var prediccionTiempo = [];
var semana = [];

weather.find(
	{
		search: 'Granada, España',
		degreeType: 'C'
	}, 
	function(err,result){
		if(err) console.log(err);
		// console.log(JSON.stringify(result,null,2));
		prediccionTiempo = result[0].forecast;
		for(let i = 0; i<prediccionTiempo.length; i++){
			semana.push(prediccionTiempo[i]);
		}
		// console.log(semana);
		// console.log(semana[0].date.split('-').reverse().join('-'));
		
		// console.log(result);

	}
);

// Se pueden seleccionar dos direcciones para la base de datos
// COMENTAR LA QUE NO SE VAYA A UTILIZAR

// - Si queremos usar una BD local:
var bd_name = "mongodb://localhost:27017/";

// - Si queremos usar la BD local proporcionada por un cluster gratuito:
// var bd_name = "mongodb+srv://usuariop4:holahola@cluster0.9ngjj.mongodb.net/pruebaBaseDatos?retryWrites=true&w=majority";

MongoClient.connect(bd_name, {useNewUrlParser: true, useUnifiedTopology: true}, function(err, db) {
	var dbo = db.db("pruebaBaseDatos");
	// var dbo = db.db("pruebaBaseDatos");
	var datos = [];
	
	// filtro pa ver si existe la BD 
	//

	dbo.collection("datos_sensores", function(err, collection){
		
		io.sockets.on('connection', function(client) {
			recogerDatos();
			io.emit('obtener',datos);
			io.emit('weather',semana);
			
			// Actualizar valores de temperatura
			client.on('nueva_temperatura', function(data){
				tmax =data.tmax;
				tmin =data.tmin;

				if(parseInt(tmax) < parseInt(tmin)){
					tmin = tmax - 20;
				}

				var dia = new Date();
    			var t = "[" + dia.getDate() + "/" + dia.getMonth() + " | " + dia.getHours() + ":" + dia.getMinutes() + ":" + dia.getSeconds() + "] --> ";
				let l = t + "Registrando nuevas temperaturas: Tmax:" + tmax + "ºC, Tmin:" + tmin + "ºC";
				log.push(l);
				console.log(l);
				
				actualizar();
			});

			// Actualizar valores de luminosidad
			client.on('nueva_luminosidad', function(data){
				lmax =data.lmax;
				lmin =data.lmin;

				if(parseInt(lmax) < parseInt(lmin)){
					lmin = lmax - 20;
				}

				var dia = new Date();
    			var t = "[" + dia.getDate() + "/" + dia.getMonth() + " | " + dia.getHours() + ":" + dia.getMinutes() + ":" + dia.getSeconds() + "] --> ";
				let l = t + "Registrando nuevas luminosidad: Lmax:" + lmax + "%, Lmin:" + lmin + "%";
				log.push(l);
				console.log(l);
				
				actualizar();
			});

			// Actualizar valores de los actuadores
			client.on('actualizarActuadores', function(data){
				persiana = data.persiana;
				aire_acondicionado = data.aire;

				actualizar();
				var dia = new Date();
    			var t = "[" + dia.getDate() + "/" + dia.getMonth() + " | " + dia.getHours() + ":" + dia.getMinutes() + ":" + dia.getSeconds() + "] --> ";
				let l = t + "Actualizando estado de los actuadores: Aire Acondicionado: " + aire_acondicionado + " | Persiana: " + persiana;
				// log.push(l);
				console.log(l);
			});

			client.on('log',function(any){
				var data = log;
				io.emit('log',data);
			})

			client.on('weather',function(any){
				var week = semana;
				io.emit('weather',week);
			})

			// Recoger datos de la BD
			function recogerDatos(){
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

				// client broadcast emit
				io.emit('obtener', datos);				
				io.emit('log',log);
				io.emit('weather',semana);
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
console.log("Usuario --> localhost:8000/usuario\n");