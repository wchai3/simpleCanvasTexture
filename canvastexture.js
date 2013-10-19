/**
 * a simple HTML canvas texture wrapper providing OO APIs inspired by http://acko.net/blog/projective-texturing-with-canvas/
 * by wangchenan
 * 0.1 
 */
if (typeof(CanvasTexture) === "undefined" || !CanvasTexture){
   var CanvasTexture = {};
}

(function (){
	CanvasTexture.Texture=function (canvas,points,options){
		this.canvas=canvas;

		this.points=points;

		this.options=default_options;
		if (typeof(options)!='undefined'){
			this.setOptions(options);	
		}

		//console.log(this.options);
		//console.log(this.points);

		this.ctx = null;
		this.transform = null;
	}

	CanvasTexture.Texture.prototype.setCanvas=function (canvas,image,points){
		
	}

	var default_options = {
	  	wireframe: false,
	  	subdivisionLimit: 5,
	  	patchSize: 64,
	  	width:0,
	  	height:0,
	  	offsetX:0,
	  	offsetY:0
	};

	CanvasTexture.Texture.prototype.setOptions=function (options){
		for(var x in options){
			if (typeof(default_options[x])!='undefined'){
				this.options[x]=options[x];
			}
		}
	}

	//CSS3 rotate3D effect
	//TODO
	//just have implemented "half page" rotation effect
	CanvasTexture.Texture.prototype.rotateY=function (degree,callback,dir){

		var that=this;
		(function loop(){
			var A=that.points[0];
			var B=that.points[1];
			var C=that.points[2];
			var D=that.points[3];

			var delta=5;

			A[0]+=dir*delta;
			C[0]+=dir*delta;

			B[0]-=dir*delta;
			D[0]-=dir*delta;

			that.points[0]=A;
			that.points[1]=B;
			that.points[2]=C;
			that.points[3]=D;

			that.update();

			if (dir==1 && A[0]<(that.options['offsetX']+that.options['width']/2)){
				setTimeout(loop,20);
			}
			else if (dir==-1 && A[0]>that.options['offsetX']){
				setTimeout(loop,20);
			}
			else {
				if (typeof(callback)=='function'){
					callback();	
				}
			}
		})();
	}

	/**
	* Update the display to match a new point configuration.
 	*/
	CanvasTexture.Texture.prototype.update = function () {

		// Get extents.
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		$.each(this.points, function () {
			minX = Math.min(minX, Math.floor(this[0]));
			maxX = Math.max(maxX, Math.ceil(this[0]));
			minY = Math.min(minY, Math.floor(this[1]));
			maxY = Math.max(maxY, Math.ceil(this[1]));
		});

		minX--; minY--; maxX++; maxY++;
		var width = maxX - minX;
		var height = maxY - minY;

		// Reshape canvas.
		this.canvas.getCanvasEl().style.left = minX +'px';
		this.canvas.getCanvasEl().style.top = minY +'px';
		this.canvas.getCanvasEl().width = width;
		this.canvas.getCanvasEl().height = height;

		// Measure texture.
		this.iw = this.canvas.image.width;
		this.ih = this.canvas.image.height;

		// Set up basic drawing context.
		this.ctx = this.canvas.getCanvasEl().getContext("2d");
		this.ctx.translate(-minX, -minY);
		this.ctx.clearRect(minX, minY, width, height);
		this.ctx.strokeStyle = "rgb(220,0,100)";

		this.transform = CanvasTexture.Util.getProjectiveTransform(this.points);

		// Begin subdivision process.
		var ptl = this.transform.transformProjectiveVector([0, 0, 1]);
		var ptr = this.transform.transformProjectiveVector([1, 0, 1]);
		var pbl = this.transform.transformProjectiveVector([0, 1, 1]);
		var pbr = this.transform.transformProjectiveVector([1, 1, 1]);

		this.ctx.beginPath();
		this.ctx.moveTo(ptl[0], ptl[1]);
		this.ctx.lineTo(ptr[0], ptr[1]);
		this.ctx.lineTo(pbr[0], pbr[1]);
		this.ctx.lineTo(pbl[0], pbl[1]);
		this.ctx.closePath();
		this.ctx.clip();

		this.divide(0, 0, 1, 1, ptl, ptr, pbl, pbr, this.options.subdivisionLimit);

		if (this.options.wireframe) {
			this.ctx.beginPath();
			this.ctx.moveTo(ptl[0], ptl[1]);
			this.ctx.lineTo(ptr[0], ptr[1]);
			this.ctx.lineTo(pbr[0], pbr[1]);
			this.ctx.lineTo(pbl[0], pbl[1]);
			this.ctx.closePath();
			this.ctx.stroke();
		}

	}


	/**
 	 * Render a projective patch.
 	 */
	CanvasTexture.Texture.prototype.divide=function(u1, v1, u4, v4, p1, p2, p3, p4, limit) {
		// See if we can still divide.
		if (limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 == 0 && u4 == 1) || ((.25 + r * 5) * area > (this.options.patchSize * this.options.patchSize))) {
	  			// Calculate subdivision points (middle, top, bottom, left, right).
	  			var umid = (u1 + u4) / 2;
	  			var vmid = (v1 + v4) / 2;
	  			var pmid = this.transform.transformProjectiveVector([umid, vmid, 1]);
	  			var pt = this.transform.transformProjectiveVector([umid, v1, 1]);
	  			var pb = this.transform.transformProjectiveVector([umid, v4, 1]);
	  			var pl = this.transform.transformProjectiveVector([u1, vmid, 1]);
	  			var pr = this.transform.transformProjectiveVector([u4, vmid, 1]);

	  			// Subdivide.
	  			limit--;
	  			this.divide(u1, v1, umid, vmid, p1, pt, pl, pmid, limit);
	  			this.divide(umid, v1, u4, vmid, pt, p2, pmid, pr, limit);
	  			this.divide(u1, vmid, umid, v4, pl, pmid, p3, pb, limit);
	  			this.divide(umid, vmid, u4, v4, pmid, pr, pb, p4, limit);

	  			if (this.options.wireframe) {
	    			this.ctx.beginPath();
	    			this.ctx.moveTo(pt[0], pt[1]);
	    			this.ctx.lineTo(pb[0], pb[1]);
	    			this.ctx.stroke();

				    this.ctx.beginPath();
	    			this.ctx.moveTo(pl[0], pl[1]);
	    			this.ctx.lineTo(pr[0], pr[1]);
	    			this.ctx.stroke();
	  			}

	  			return;
			}
		}

		// Render this patch.
		this.ctx.save();

		// Set clipping path.
		this.ctx.beginPath();
		this.ctx.moveTo(p1[0], p1[1]);
		this.ctx.lineTo(p2[0], p2[1]);
		this.ctx.lineTo(p4[0], p4[1]);
		this.ctx.lineTo(p3[0], p3[1]);
		this.ctx.closePath();
		//ctx.clip();

		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		switch (amax) {
		case a1:
		  this.ctx.transform(d12[0], d12[1], -d31[0], -d31[1], p1[0], p1[1]);
		  // Calculate 1.05 pixel padding on vector basis.
		  if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
		  if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
		  break;
		case a2:
		  this.ctx.transform(d12[0], d12[1],  d24[0],  d24[1], p2[0], p2[1]);
		  // Calculate 1.05 pixel padding on vector basis.
		  if (u4 != 1) padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]);
		  if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
		  dx = -1;
		  break;
		case a4:
		  this.ctx.transform(-d43[0], -d43[1], d24[0], d24[1], p4[0], p4[1]);
		  // Calculate 1.05 pixel padding on vector basis.
		  if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
		  if (v4 != 1) pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]);
		  dx = -1;
		  dy = -1;
		  break;
		case a3:
		  // Calculate 1.05 pixel padding on vector basis.
		  this.ctx.transform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0], p3[1]);
		  if (u4 != 1) padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]);
		  if (v4 != 1) pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]);
		  dy = -1;
		  break;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		var padu = padx * du;
		var padv = pady * dv;

		this.ctx.drawImage(
			this.canvas.image,
			u1 * this.iw,
			v1 * this.ih,
			Math.min(u4 - u1 + padu, 1) * this.iw,
			Math.min(v4 - v1 + padv, 1) * this.ih,
			dx, dy,
			1 + padx, 1 + pady
		);
		this.ctx.restore();
	}
	

})();



(function (){
	"use strict";
	CanvasTexture.Util = {};
/*
	CanvasTexture.Util.createCanvas=function (id, config ,containerSelector){
	  	// Create <canvas>
	  	var canvas;
	  	if (typeof G_vmlCanvasManager != 'undefined') {
	    	canvas = document.createElement('canvas');
	    	canvas.id = id;
	    	canvas.width = config.width;
	    	canvas.height = config.height;
			$(containerSelector).append(canvas);
	    	canvas = G_vmlCanvasManager.initElement(canvas);
	  	}
	  	else {
	    	canvas = $('<canvas id="'+id+'" width="'+ config.width +'" height="'+ config.height +'"></canvas>');
	    	$(containerSelector).append(canvas);
	    	canvas = canvas[0];
	  	}

	  	return canvas;
	}
*/
	/**
	 * Calculate a projective transform that maps [0,1]x[0,1] onto the given set of points.
	 */
	CanvasTexture.Util.getProjectiveTransform = function(points) {
	  var eqMatrix = new Matrix(9, 8, [
	    [ 1, 1, 1,   0, 0, 0, -points[3][0],-points[3][0],-points[3][0] ], 
	    [ 0, 1, 1,   0, 0, 0,  0,-points[2][0],-points[2][0] ],
	    [ 1, 0, 1,   0, 0, 0, -points[1][0], 0,-points[1][0] ],
	    [ 0, 0, 1,   0, 0, 0,  0, 0,-points[0][0] ],

	    [ 0, 0, 0,  -1,-1,-1,  points[3][1], points[3][1], points[3][1] ],
	    [ 0, 0, 0,   0,-1,-1,  0, points[2][1], points[2][1] ],
	    [ 0, 0, 0,  -1, 0,-1,  points[1][1], 0, points[1][1] ],
	    [ 0, 0, 0,   0, 0,-1,  0, 0, points[0][1] ]

	  ]);
	  
	  var kernel = eqMatrix.rowEchelon().values;
	  var transform = new Matrix(3, 3, [
	    [-kernel[0][8], -kernel[1][8], -kernel[2][8]],
	    [-kernel[3][8], -kernel[4][8], -kernel[5][8]],
	    [-kernel[6][8], -kernel[7][8],             1]
	  ]);
	  return transform;
	}
	
})();

(function (){
	CanvasTexture.Canvas = function (canvasEl,image,callback){
		this.canvasEl=canvasEl;
		
		if (typeof(image)=='Object'){
			this.image=image;
			if (typeof(callback)=='function'){
				callback();
			}
		}else {
			this.refreshImage(callback);
		}
	};

	CanvasTexture.Canvas.prototype.loadImage = function (image){
		this.image=image;
	};

	CanvasTexture.Canvas.prototype.refreshImage = function (callback){
		var canvasImageURL=this.canvasEl.toDataURL("image/jpg", 1.0);
		this.image = new Image();
		this.image.onload = function () {
			if (typeof(callback)=='function'){
				callback();
			}
		};
		this.image.src=canvasImageURL;
	};



	CanvasTexture.Canvas.prototype.setTexture = function (texture){
		this.texture=texture;
	};

	CanvasTexture.Canvas.prototype.getTexture = function (texture){
		return this.texture;
	};


	CanvasTexture.Canvas.prototype.getCanvasEl = function (){
		return this.canvasEl;
	};


	CanvasTexture.Container = function (container){
		this.$CONTAINER=$(container);
		this.canvases={};
	};

	CanvasTexture.Container.prototype._createCanvas = function (config){
	  	var canvas;
	  	if (typeof G_vmlCanvasManager != 'undefined') {
	    	canvas = document.createElement('canvas');
	    	canvas.id = config.id;
	    	canvas.width = config.width;
	    	canvas.height = config.height;
			this.$CONTAINER.append(canvas);
	    	canvas = G_vmlCanvasManager.initElement(canvas);
	  	}
	  	else {
	    	canvas = $('<canvas id="'+config.id+'" width="'+ config.width +'" height="'+ config.height +'"></canvas>');
	    	this.$CONTAINER.append(canvas);
	    	canvas = canvas[0];
	  	}
	  	return canvas;
	};

	CanvasTexture.Container.prototype.createCanvas = function (config,callback){
	  	var canvasEl=this._createCanvas(config);
	  	var that=this;
	  	var canvas=new CanvasTexture.Canvas(canvasEl,null,function (){
	  		
		});
	  	that.canvases[config.id]=canvas;
		return canvas;

	};

	CanvasTexture.Container.prototype.addCanvas = function (canvasEl,id){
		var canvasClone=this._createCanvas({
			id:id,
			width:canvasEl.width,
			height:canvasEl.height
		});

		var ctx=canvasClone.getContext('2d');
		ctx.drawImage(canvasEl, 0, 0);

		//console.log(canvasEl.toDataURL());
		//console.log(canvasClone.toDataURL());

		this.canvases[id]=new CanvasTexture.Canvas(canvasClone);
		return this.canvases[id];
	};


	CanvasTexture.Container.prototype.getCanvas = function (id){
		if (typeof(id)=='undefined'){
			return this.canvases;
		}
		return this.canvases[id];
	};


	CanvasTexture.Container.prototype.buildCanvasTexture = function (canvasId,offsetX,offsetY,width,height,initPoint){
	
		var texture=new CanvasTexture.Texture(
			this.canvases[canvasId],
			initPoint,
			{
				offsetX:offsetX,
				offsetY:offsetY,
				width:width,
				height:height
			}
		);

		this.canvases[canvasId].setTexture(texture);
		return texture;
	};




})();