function wrap(x) {
    x = ((x + 256) & 0x1ff) - 256;
    if (x < 0) x = -x;
    return x;
}

function Mandelbrot(canvas,numberOfWorkers,workSrc){
    this.canvas=canvas;
    this.ctx=this.canvas.getContext("2d");
    this.i_max=1.5;
    this.i_min=-1.5;
    this.r_max=1.5;
    this.r_min=-2.5;
    this.max_iter=1024;
    this.palette=[];
    this.escape=100;
    this.workerSrc=workSrc;

    this.numberOfWorkers = numberOfWorkers;
    this.workers = [];
    this.rowData=null;
    this.nextRow = 0;
    this.generation = 0;
    this.canvasData=[];

    console.log("variables inited ....");
    var width = ((this.i_max - this.i_min) * this.canvas.width / this.canvas.height);
    var r_mid = (this.r_max + this.r_min) / 2;

    this.r_min = r_mid - width/2;
    this.r_max = r_mid + width/2;

    this.rowData = this.ctx.createImageData(this.canvas.width, 1);

    for (var i = 0; i <= this.max_iter; i++) {
        this.palette.push([wrap(7*i), wrap(5*i), wrap(11*i)]);
    }

    this.hireWorkers();
}

Mandelbrot.prototype.drawRow=function(workerResults) {
//    console.log("draw one row  -------------");
    var values = workerResults.values;  // The values array the worker sends back
    var pixelData = this.rowData.data;       // The actual pixels in the ImageData obj
    for (var i = 0; i < this.rowData.width; i++) {  // for each pixel in the row
        var red = i * 4;
        var green = i * 4 + 1;
        var blue = i * 4 + 2;
        var alpha = i * 4 + 3;

        pixelData[alpha] = 255; // set alpha to opaque

        if (values[i] < 0) {
            pixelData[red] = pixelData[green] = pixelData[blue] = 0;
        } else {
            var color = this.palette[values[i]];
            pixelData[red] = color[0];
            pixelData[green] = color[1];
            pixelData[blue] = color[2];
        }
    }
    this.ctx.putImageData(this.rowData, 0, workerResults.row);
}

Mandelbrot.prototype.hireWorkers=function() {
//    console.log("hireWorkers -------------");
    for (var i = 0; i < this.numberOfWorkers; i++) {
        var worker = new Worker(this.workerSrc);
        var mandelbrot=this;
        worker.onmessage = function(event) {
            collectData(mandelbrot,event);
        };
        worker.idle = true;
        this.workers.push(worker);
    }
}

Mandelbrot.prototype.draw=function(){
//    console.log("draw -------------");
    for(var i=0;i<this.canvasData.length;i++){
        this.drawRow(this.canvasData[i]);
    }
}

Mandelbrot.prototype.reassignWorker=function(worker){
//    console.log("reassignWorker  -------------");
    if (this.row >= this.canvas.height) {
        worker.idle = true;
    } else {
        var task = this.createTask();
        worker.idle = false;
        worker.postMessage(task);
    }
}


function collectData(mandelbrot,resultEvent){
    var workerResult=resultEvent.data;
    var worker=resultEvent.target;

//    console.log("collectData  -------------");
    if (workerResult.generation == mandelbrot.generation) {
        mandelbrot.drawRow(workerResult);
    }
    mandelbrot.reassignWorker(worker);
}


Mandelbrot.prototype.plot=function(){
    console.log("doWork  -------------");
    this.generation++;
    this.nextRow = 0;

    for (var i = 0; i < this.workers.length; i++) {
        var worker = this.workers[i];
        if (worker.idle) {
            var task = this.createTask();
            worker.idle = false;
            worker.postMessage(task);
            this.nextRow++;
        }
    }
}

Mandelbrot.prototype.createTask=function() {
    console.log("createTask  -------------");
    var task = {
        row: this.nextRow,               // row number we're working on
        width: this.rowData.width,   // width of the ImageData object to fill
        generation: this.generation, // how far in we are
        r_min: this.r_min,
        r_max: this.r_max,
        i: this.i_max + (this.i_min - this.i_max) * this.nextRow / this.canvas.height,
        max_iter: this.max_iter,
        escape: this.escape
    };
    this.nextRow++;
    return task;
}

Mandelbrot.prototype.centerXY=function(x,y){
    var width = this.r_max - this.r_min;
    var height = this.i_min - this.i_max;
    var click_r = this.r_min + ((width * x) / this.canvas.width);
    var click_i = this.i_max + ((height * y) / this.canvas.height);

    var zoom = 8;

    this.r_min = click_r - width/zoom;
    this.r_max = click_r + width/zoom;
    this.i_max = click_i - height/zoom;
    this.i_min = click_i + height/zoom;
}




window.onload = init;

function init() {
    var canvas=document.getElementById("fractal");
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
    
    var mandelbrot=new Mandelbrot(canvas,8,"/source/js/worker.js");
    mandelbrot.plot();
    canvas.onclick = function(event) {
        mandelbrot.centerXY(event.clientX, event.clientY);
        mandelbrot.plot();
    };

}
