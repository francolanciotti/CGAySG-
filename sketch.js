// Variables para las nubes
let imagenesNubes = [];
let cantidadNubes = 7;
let imgTextura; // Variable para la imagen de textura de fondo

// Variables de posición y perspectiva
let datosNubes = [];
let offsetVertical = 0;

// Variables para el horizonte y colores estáticos (Georgia O'Keeffe - original)
let horizonteY;
let colorCieloCenit;
let colorCieloMedio;
let colorCieloHorizonte;
let colorMarHorizonte;
let colorMarAbajo;

// Variables para la interacción por sonido
let gestorAudio;
let audioIniciado = false;

function preload() {
  // Cargamos las imágenes de las nubes antes de que inicie el sketch
  for (let i = 1; i <= cantidadNubes; i++) {
    imagenesNubes.push(loadImage('img/nube' + i + '.png'));
  }
  imgTextura = loadImage('img/textura.png');
}

function setup() {
  // Proporción panorámica, similar a los lienzos de O'Keeffe
  createCanvas(1200, 600);

  // Definimos la altura del horizonte (ej: 25% de la pantalla hacia abajo, marca el inicio del mar)
  horizonteY = height * 0.25;

  // Definimos la paleta estática del cielo (Georgia O'Keeffe)
  colorCieloCenit = color(168, 188, 195);     // Gris-celeste arriba
  colorCieloMedio = color(225, 226, 221);     // Blanco-crema en el medio
  colorCieloHorizonte = color(232, 208, 204); // Rosado-arena cerca del horizonte

  // Definimos la paleta estática del mar
  colorMarHorizonte = color(208, 226, 245);   // Celeste claro cerca del horizonte
  colorMarAbajo = color(30, 77, 117);         // Azul profundo abajo

  // Instanciar el gestor de audio
  gestorAudio = new GestorAudio();

  // Generamos los datos base de las nubes una sola vez
  generarNubes();
}

/**
 * Genera la grilla tridimensional de nubes base
 */
function generarNubes() {
  let cantidadFilas = 16; // Cantidad de hileras de nubes desde el horizonte

  for (let fila = 0; fila < cantidadFilas; fila++) {
    let yPos = map(fila, 0, cantidadFilas, 0, 1000); // Grilla virtual espaciada de forma lineal (0 a 1000)

    let spacingX = 320; // Espaciado base en 3D (mayor que el ancho de 250 para evitar contacto)
    let offsetX = (fila % 2 === 0) ? 0 : (spacingX * 0.5);

    // Columnas de -10 a 10 para cubrir todo el horizonte
    for (let col = -10; col <= 10; col++) {
      let xPos = width / 2 + col * spacingX + offsetX;

      // Variaciones sutiles
      let variacionX = random(-20, 20);
      let variacionY = random(-10, 10);
      let factorAleatorio = random(-0.2, 0.2); // Rango de variación base para el tamaño

      let xBase = xPos + variacionX;
      let yBase = yPos + variacionY;
      let imgIndex = Math.abs(fila + col) % cantidadNubes;

      // Guardamos la nube en la lista
      datosNubes.push({
        xBase: xBase,
        yBase: yBase,
        anchoBase: 250,
        altoBase: 120,
        imgIndex: imgIndex,
        factorAleatorio: factorAleatorio,
        variacionSonidoGuardada: 0
      });
    }
  }
}

function draw() {
  dibujarFondo();
  imageMode(CORNER);
  image(imgTextura, 0, 0, width, height + 200);
  imageMode(CENTER);

  // Procesar e interactuar con el micrófono si el audio está activo
  if (audioIniciado) {
    gestorAudio.analizar();

    // El sonido da inicio al movimiento: sólo avanza si hay sonido por encima del umbral
    if (gestorAudio.haySonido) {
      let velocidad = map(gestorAudio.volSuave, 0.005, 0.15, 0.5, 6.0, true);
      offsetVertical -= velocidad; // Desplazamiento lineal uniforme
    }
  }

  // Recorrer las nubes y dibujarlas con perspectiva y oscilación sonora
  for (let i = 0; i < datosNubes.length; i++) {
    let nube = datosNubes[i];

    // Desplazamiento e infinitud (envoltura) en el espacio virtual (0 a 1000)
    let rangeY = 1000;
    let yVirtual = ((nube.yBase + offsetVertical) % rangeY);
    if (yVirtual < 0) yVirtual += rangeY;

    // Calcular profundidad virtual con perspectiva no lineal (exponente 2.5)
    let profundidadVirtual = pow(yVirtual / rangeY, 2.5);

    // Mapear a la coordenada Y física de pantalla
    let yFinal = map(profundidadVirtual, 0, 1, horizonteY + 10, height + 400);

    // Optimización: No dibujar nubes que estén muy por debajo de la pantalla visible
    if (yFinal > height + 150) {
      continue;
    }

    // Calcular escala y dimensiones base con perspectiva
    let escala = map(profundidadVirtual, 0, 1, 0.25, 2.3);
    let xFinal = width / 2 + (nube.xBase - width / 2) * escala;
    let anchoBaseDinamico = 250 * escala;
    let factorAplastamiento = map(profundidadVirtual, 0, 0.8, 0.25, 1.0, true);
    let altoBaseDinamico = 120 * escala * factorAplastamiento;

    // Modulación de tamaño impulsada por el sonido (graves vs agudos)
    let variacionSonido = 0;
    if (audioIniciado && gestorAudio.haySonido) {
      let offsetNube = nube.xBase * 0.05 + nube.yBase * 0.05;

      // Dividir el balance de tono en intensidad para graves y agudos (estilo la interacción de ratón anterior)
      let intensidadGrave = constrain(map(gestorAudio.balanceTono, 0.5, 0.0, 0, 1), 0, 1);
      let intensidadAgudo = constrain(map(gestorAudio.balanceTono, 0.5, 1.0, 0, 1), 0, 1);

      // Graves: oscilación sinusoidal suave
      let valGrave = sin(frameCount * 0.1 + offsetNube) * 0.12;
      // Agudos: ruido rápido y errático
      let valAgudo = (noise(frameCount * 0.35 + offsetNube, nube.imgIndex) - 0.5) * 2 * 0.45;

      // El volumen suavizado controla la magnitud del escalado
      let escalaModulacion = map(gestorAudio.volSuave, 0.005, 0.15, 0.2, 1.8, true);
      variacionSonido = (valGrave * intensidadGrave + valAgudo * intensidadAgudo) * escalaModulacion;

      // Transición amortiguada hacia el nuevo tamaño con sonido
      nube.variacionSonidoGuardada = lerp(nube.variacionSonidoGuardada, variacionSonido, 0.2);
    } else {
      // Retornar suavemente a la escala normal (1.0) en silencio
      nube.variacionSonidoGuardada = lerp(nube.variacionSonidoGuardada, 0, 0.08);
    }

    let multiplicadorSonido = 1 + nube.variacionSonidoGuardada;
    let anchoFinal = anchoBaseDinamico * multiplicadorSonido;
    let altoFinal = altoBaseDinamico * multiplicadorSonido;

    image(imagenesNubes[nube.imgIndex], xFinal, yFinal, anchoFinal, altoFinal);
  }

  // Dibujar el overlay interactivo si el audio no ha sido habilitado por el usuario
  if (!audioIniciado) {
    dibujarOverlayBienvenida();
  }
}

function dibujarFondo() {
  // DIBUJAR EL CIELO (de arriba hasta el horizonte)
  for (let y = 0; y <= horizonteY; y++) {
    let interpolacion = map(y, 0, horizonteY, 0, 1);
    let colorActual = lerpColor(colorCieloCenit, colorCieloHorizonte, interpolacion);

    stroke(colorActual);
    line(0, y, width, y);
  }

  // DIBUJAR EL MAR (desde el horizonte hasta abajo)
  for (let y = horizonteY; y <= height; y++) {
    let interpolacion = map(y, horizonteY, height, 0, 1);
    let colorActual = lerpColor(colorMarHorizonte, colorMarAbajo, interpolacion);

    stroke(colorActual);
    line(0, y, width, y);
  }
}

/**
 * Dibuja una pantalla de bienvenida glassmorphic para que el usuario
 * interactúe con la página y habilite el motor de audio del navegador.
 */
function dibujarOverlayBienvenida() {
  push();
  // Forzar modos de dibujo para asegurar que todo esté perfectamente centrado y alineado
  rectMode(CENTER);
  ellipseMode(CENTER);
  imageMode(CENTER);

  // Fondo oscuro traslúcido
  background(15, 20, 30, 200);

  let cx = width / 2;
  let cy = height / 2;

  // Resplandor exterior del panel
  fill(255, 255, 255, 3);
  rect(cx, cy, 580, 380, 20);

  // Panel principal
  fill(10, 15, 25, 230);
  stroke(255, 255, 255, 45);
  strokeWeight(2);
  rect(cx, cy, 560, 360, 16);

  // Título
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textFont('Helvetica Neue, Arial, sans-serif');
  textSize(24);
  textStyle(BOLD);
  text("TP Quinta Obra", cx, cy - 110);

  // Línea divisoria decorativa
  stroke(255, 255, 255, 30);
  strokeWeight(1);
  line(cx - 80, cy - 80, cx + 80, cy - 80);

  // Texto instructivo
  noStroke();
  fill(200, 210, 225);
  textSize(13);
  textStyle(NORMAL);
  textAlign(CENTER, TOP);
  let instrucciones =
    "Ajusta los rangos del micrófono abajo si es necesario.\n" +
    "• SILENCIO: Pausa.\n" +
    "• SONIDO / VOZ: Inicia. \n" +
    "• TONOS GRAVES: Produce ondulaciones suaves.\n" +
    "• TONOS AGUDOS: Produce una vibración errática.";
  text(instrucciones, cx, cy - 55);

  // Dibujar Controles de Configuración de Micrófono
  let controlY1 = cy + 45; // Fila del Umbral
  let controlY2 = cy + 90; // Fila de la Sensibilidad

  textSize(13);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  fill(180, 190, 210);
  text("Umbral de Ruido (Filtro):", cx - 210, controlY1);
  text("Sensibilidad (Ganancia):", cx - 210, controlY2);

  // Umbral - Botón [-]
  drawControlBtn(cx + 60, controlY1, "-");
  // Umbral - Valor
  textAlign(CENTER, CENTER);
  fill(255);
  textStyle(BOLD);
  text(gestorAudio.umbralRuido.toFixed(3), cx + 110, controlY1);
  // Umbral - Botón [+]
  drawControlBtn(cx + 160, controlY1, "+");

  // Sensibilidad - Botón [-]
  drawControlBtn(cx + 60, controlY2, "-");
  // Sensibilidad - Valor
  textAlign(CENTER, CENTER);
  fill(255);
  textStyle(BOLD);
  text(gestorAudio.sensibilidad.toFixed(1) + "x", cx + 110, controlY2);
  // Sensibilidad - Botón [+]
  drawControlBtn(cx + 160, controlY2, "+");

  // Botón/Instrucción "Presiona [ESPACIO] para comenzar"
  let promptY = cy + 140;
  let pulse = sin(frameCount * 0.08) * 40 + 215; // Brillo oscilante
  noStroke();
  fill(pulse, pulse, 255);
  textSize(13);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text("PRESIONA LA BARRA [ ESPACIO ] PARA COMENZAR", cx, promptY);

  // Gestor del cursor sobre botones
  let hoverAlguna = mouseEnBoton(cx + 60, controlY1, 30, 24) ||
    mouseEnBoton(cx + 160, controlY1, 30, 24) ||
    mouseEnBoton(cx + 60, controlY2, 30, 24) ||
    mouseEnBoton(cx + 160, controlY2, 30, 24);
  if (hoverAlguna) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }

  pop();

  // Restaurar modos predeterminados para evitar bugs de centrado
  rectMode(CORNER);
  imageMode(CORNER);
}

/**
 * Función auxiliar para dibujar un botón de control en el panel
 */
function drawControlBtn(bx, by, label) {
  let bw = 30;
  let bh = 24;
  let sobre = mouseEnBoton(bx, by, bw, bh);

  if (sobre) {
    fill(255, 255, 255, 45);
    stroke(255, 255, 255, 120);
  } else {
    fill(255, 255, 255, 15);
    stroke(255, 255, 255, 40);
  }
  strokeWeight(1);
  rectMode(CENTER);
  rect(bx, by, bw, bh, 4);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text(label, bx, by - 1);
}

/**
 * Comprueba si las coordenadas del ratón están dentro de un botón centrado
 */
function mouseEnBoton(bx, by, bw, bh) {
  return mouseX > bx - bw / 2 && mouseX < bx + bw / 2 && mouseY > by - bh / 2 && mouseY < by + bh / 2;
}

/**
 * Captura el clic del usuario para la calibración antes del inicio.
 */
function mouseClicked() {
  if (!audioIniciado) {
    let cx = width / 2;
    let cy = height / 2;
    let controlY1 = cy + 45;
    let controlY2 = cy + 90;

    // Umbral [-]
    if (mouseEnBoton(cx + 60, controlY1, 30, 24)) {
      gestorAudio.umbralRuido = max(0.001, gestorAudio.umbralRuido - 0.002);
    }
    // Umbral [+]
    if (mouseEnBoton(cx + 160, controlY1, 30, 24)) {
      gestorAudio.umbralRuido = min(0.100, gestorAudio.umbralRuido + 0.002);
    }
    // Sensibilidad [-]
    if (mouseEnBoton(cx + 60, controlY2, 30, 24)) {
      gestorAudio.sensibilidad = max(0.2, gestorAudio.sensibilidad - 0.1);
    }
    // Sensibilidad [+]
    if (mouseEnBoton(cx + 160, controlY2, 30, 24)) {
      gestorAudio.sensibilidad = min(5.0, gestorAudio.sensibilidad + 0.1);
    }
  }
}

/**
 * Captura la barra espaciadora para iniciar/pausar el audio de manera segura
 */
function keyPressed() {
  if (key === ' ') {
    if (!audioIniciado) {
      userStartAudio();
      gestorAudio.inicializar();
      audioIniciado = true;
      cursor(ARROW);
    } else {
      audioIniciado = false; // Permite volver a abrir el panel con espacio
    }
    return false; // Evita el scroll por defecto de la barra espaciadora
  }
}

/**
 * Clase para gestionar la señal de audio de entrada del micrófono y
 * realizar el análisis de frecuencias para diferenciar graves de agudos.
 */
class GestorAudio {
  constructor() {
    this.mic = null;
    this.fft = null;
    this.umbralRuido = 0.015; // Filtro para ignorar el ruido ambiental
    this.sensibilidad = 1.0;  // Multiplicador de volumen (ganancia)
    this.volSuave = 0.0;
    this.factorAmortiguacion = 0.15; // Suavizado de la señal (0 a 1)
    this.haySonido = false;
    this.antesHabiaSonido = false;
    this.centroideSuave = 800; // Frecuencia central de la voz humana aproximada
    this.balanceTono = 0.5; // Balance de tono: 0 (graves) a 1 (agudos)
  }

  /**
   * Inicializa el micrófono y conecta el analizador de frecuencia (FFT)
   */
  inicializar() {
    this.mic = new p5.AudioIn();
    this.mic.start(() => {
      console.log("Micrófono activado con éxito.");
    });
    this.fft = new p5.FFT();
    this.fft.setInput(this.mic);
  }

  /**
   * Captura la amplitud y frecuencia, aplicando amortiguación y normalización
   */
  analizar() {
    if (!this.mic || !this.fft) return;

    let volCrudo = this.mic.getLevel();
    // Filtro de ruido de fondo
    let volFiltrado = volCrudo > this.umbralRuido ? volCrudo : 0.0;

    // Aplicar sensibilidad configurada
    let volConGanancia = volFiltrado * this.sensibilidad;

    // Suavizado exponencial del volumen
    this.volSuave = lerp(this.volSuave, volConGanancia, this.factorAmortiguacion);

    this.antesHabiaSonido = this.haySonido;
    this.haySonido = this.volSuave > 0.005;

    // Análisis del espectro de frecuencia
    this.fft.analyze();
    let centroide = this.fft.getCentroid(); // Centroide espectral en Hz

    if (this.haySonido) {
      // Suavizar la transición de la frecuencia promedio
      this.centroideSuave = lerp(this.centroideSuave, centroide, 0.1);

      // Mapear frecuencia: 400Hz (voz grave o soplido) a 2000Hz (silbido o voz aguda)
      this.balanceTono = map(this.centroideSuave, 400, 2000, 0, 1, true);
    } else {
      // Retornar suavemente al estado de equilibrio en silencio
      this.centroideSuave = lerp(this.centroideSuave, 1000, 0.03);
      this.balanceTono = lerp(this.balanceTono, 0.5, 0.03);
    }
  }

  /**
   * Compara el estado actual con el fotograma anterior para detectar el
   * inicio exacto de un sonido (evento de disparo)
   */
  detectarDisparo() {
    return this.haySonido && !this.antesHabiaSonido;
  }
}
