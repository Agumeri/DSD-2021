var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

var httpServer = http.createServer(
	function(request, response) {
		var uri = url.parse(request.url).pathname;
		if (uri=="/") uri = "/sensor.html";
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

	dbo.collection("datos_sensores", function(err, collection){
		io.sockets.on('connection', function(client) {

			// Actualizar valores de temperatura
			client.on('nueva_temperatura', function(data){
				collection.updateOne({"Tipo": "temperatura"},
				{
					$set: {
							'tmin': data.min,
							'tmax': data.max
						  }
				});
				console.log("Se ha actualizado la temperatura");
			});

			// Actualizar valores de luminosidad
			client.on('nueva_luminosidad', function(data){
				collection.updateOne({"Tipo": "luminosidad"},
				{
					$set: {
							'lmin': data.min,
							'lmax': data.max
						  }
				});
				console.log("Se ha actualizado la luminosidad");
			});

			// Obtener datos de la base de datos
			client.on('obtener', function (data) {
				collection.find().toArray(function(err, results){
					client.emit('obtener', results);
					console.log(results);
				});
			});

			// Resetear la base de datos 
			client.on('reset', function(data){
				collection.drop();
				console.log("Un cliente ha reseteado la BD");
			})
		});
    });
});

console.log("Servicio MongoDB iniciado");
console.log("Acceder al servidor sensor localhost:8000");
