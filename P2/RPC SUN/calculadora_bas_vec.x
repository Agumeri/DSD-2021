/*Constantes y creación del vector*/
const MAX = 3; 			/*Capacidad maxima del vector que va a manejar la calculadora*/

struct datos{
	double v1<MAX>;
	double v2<MAX>;
};

struct vec{
	double x;
	double y;
	double z;
};

program CALCULADORA {
	version BASICA {
		double sumar(double x, double y) = 1;
		double restar(double x, double y) = 2;
		double mutiplicar(double x, double y) = 3;
		double dividir(double x, double y) = 4;
		double potencia(double x, double y) = 5;
		double raiz(double x) = 6;
		double seno(double x) = 7;
		double coseno(double x) = 8;
		double tangente(double x) = 9;
		double logBase(double x) = 10;
		vec sumar_vectores(datos vectores) = 11;
		vec restar_vectores(datos vectores) = 12;
		double productoEscalar(datos vectores) = 13;
	} =1;
} = 0x20000001;
