var ThreeSetup = function() {
	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    //this.camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2,  window.innerHeight / 2, window.innerHeight / -2, 0.1, 100);
	
	this.renderer = new THREE.WebGLRenderer({ antialias:true });
	
	
	this.initRenderer();
    this.initControls();
	this.initCamera();
}

ThreeSetup.prototype.initControls = function() {
	this.controls.rotateSpeed = 1.0;
	this.controls.zoomSpeed = 1.2;
	this.controls.panSpeed = 1.8;
	this.controls.noZoom = false;
	this.controls.noPan = false;
	this.controls.staticMoving = true;
	this.controls.dynamicDampingFactor = 0.3;
	this.controls.keys = [ 65, 83, 68 ];
}

ThreeSetup.prototype.initRenderer = function() {
	this.renderer.setClearColor(0xeeeeee);
	this.renderer.setSize(window.innerWidth, window.innerHeight);
		console.log
	document.body.appendChild(this.renderer.domElement);
    var canvasa=document.getElementsByTagName("canvas")[0];
    this.controls = new THREE.TrackballControls(this.camera,canvasa);
}

ThreeSetup.prototype.initCamera = function() {
	this.camera.position.z = 1;
}

ThreeSetup.prototype.resize = function() {
	this.camera.aspect = window.innerWidth/window.innerHeight;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize(window.innerWidth, window.innerHeight);
	this.controls.handleResize();
}

ThreeSetup.prototype.render = function() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
}

function dispose3(obj) {
    /**
     *  @author Marco Sulla (marcosullaroma@gmail.com)
     *  @date Mar 12, 2016
     */

    "use strict";

    var children = obj.children;
    var child;

    if (children) {
        for (var i=0; i<children.length; i+=1) {
            child = children[i];

            dispose3(child);
        }
    }

    var geometry = obj.geometry;
    var material = obj.material;

    if (geometry) {
        geometry.dispose();
    }

    if (material) {
        var texture = material.map;

        if (texture) {
            texture.dispose();
        }

        material.dispose();
    }
}