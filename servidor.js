var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

// Umbrales de los sensores
var TEMP_MAX = "100";
var TEMP_MIN = "0";
var LUM_MAX = "100";
var LUM_MIN = "0";

var tmax;
var tmin;
var lmax;
var lmin;
//

var log = "";

// Valores de los actuadores
// Apagado/Cerrada == false
// Encendido/Abierta == true
var persiana = false;
var aire_acondicionado = false;
//

function agente_sistema(){
	let t = Date.now()

	// Administramos temperatura
	if (tmax >= TEMP_MAX){
		aire_acondicionado = true;
		tmax = 27;
		log = t + ": Se ha encendido el aire acondicionado. Que calor hace!!!\n";
	} else if(tmin <= TEMP_MIN){
		aire_acondicionado = false;
		tmin = 5;
		log = t + ": Apagando el aire acondicionado, que hace fresquete";
	}

	// Administramos luminosidad
	if (lmax >= LUM_MAX){
		persiana = false;
		lmax = 80;
		log = t + ": Demasiada luz, cerrando la persiana";
	} else if(lmin <= LUM_MIN){
		persiana = true;
		lmin = 10
		log = t + ": Abriendo la persiana, que esto parece una cueva";
	}
}

var httpServer = http.createServer(
	function(request, response) {
		var uri = url.parse(request.url).pathname;
		if (uri=="/sensor") uri = "/sensor.html"
		else if (uri=="/usuario") uri = "/usuario.html";
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


MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true, useUnifiedTopology: true}, function(err, db) {
	httpServer.listen(8000);
	var io = socketio(httpServer);
	var dbo = db.db("pruebaBaseDatos");
	var datos = {};
	// filtro pa ver si existe la BD 
	dbo.collection("datos_sensores", function(err, collection){
		
		io.sockets.on('connection', function(client) {
			recogerDatos();
			client.emit('obtener',datos);
			
			// Actualizar valores de temperatura
			client.on('nueva_temperatura', function(data){
				tmax =data.tmax;
				tmin =data.tmin;

				collection.updateOne({"Tipo": "temperatura"},
				{
					$set: {
							'tmin': data.tmin,
							'tmax': data.tmax
						  }
				});
				let t = Date.now()
				log = t + ": Se ha actualizado la temperatura a " + tmax + "%\n";
				
				actualizar();
			});

			// Actualizar valores de luminosidad
			client.on('nueva_luminosidad', function(data){
				lmax =data.lmax;
				lmin =data.lmin;

				collection.updateOne({"Tipo": "luminosidad"},
				{
					$set: {
							'lmin': data.lmin,
							'lmax': data.lmax
						  }
				});
				let t = Date.now()
				log = t + ": Se ha actualizado la luminosidad a " + lmax + "%\n";
				
				actualizar();
			});

			// Actualizar valores de los actuadores
			client.on('actualizarActuadores', function(data){
				persiana = data.persiana;
				aire_acondicionado = data.aire;

				collection.updateOne({"Tipo": "actuadores"},
				{
					$set: {
							'persiana': persiana,
							'aire_acondicionado': aire_acondicionado
						  }
				});
				actualizar();
			});

			// Recoger datos de la BD
			function recogerDatos(){
				// collection.updateOne({"Tipo": "actuadores"},
				// {
				// 	$set: {
				// 			'persiana': persiana,
				// 			'aire_acondicionado': aire_acondicionado
				// 		  }
				// });
				
				collection.find().toArray(function(err, results){
					io.emit('obtener', results);
					datos = results;
				});
				
			}

			// Actualizar valores en el cliente
			function actualizar(){
				recogerDatos();
				// agente_sistema();
				io.emit('obtener', datos);

			}


			// Obtener datos de la base de datos
			// client.on('obtener', function (data) {
			// 	collection.find().toArray(function(err, results){
			// 		client.emit('obtener', results);
			// 		// console.log(results);
			// 	});
			// });

			// Conexion
			// client.on('conn-sens', function(data){
			// 	console.log("Un sensor se ha conectado al servidor");
			// })
		});
    });
});

console.log("Servicio MongoDB iniciado");
console.log("Servidor escuchando en el puerto 8000");
console.log("\nRutas disponibles")
console.log("Sensor --> localhost:8000/sensor");
console.log("Usuario --> localhost:8000/usuario");
