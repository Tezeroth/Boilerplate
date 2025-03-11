/* jshint esversion: 9 */
/* global THREE, AFRAME */

/**
 * This component hides the entity when AR hit testing starts and shows it again when VR mode is exited.
 * Useful for indicators or placeholders that you only want visible before the AR scene is anchored.
 */
AFRAME.registerComponent("hide-on-hit-test-start", {
  init: function() {
    var self = this;
    this.el.sceneEl.addEventListener("ar-hit-test-start", function() {
      self.el.object3D.visible = false;
    });
    this.el.sceneEl.addEventListener("exit-vr", function() {
      self.el.object3D.visible = true;
    });
  }
});

/**
 * Reset position and rotation when AR starts.
 */
AFRAME.registerComponent("origin-on-ar-start", {
  init: function() {
    var self = this.el;
    this.el.sceneEl.addEventListener("enter-vr", function() {
      if (this.is("ar-mode")) {
        self.setAttribute('position', {x:0,y:0,z:0});
        self.setAttribute('rotation', {x:0,y:0,z:0});
      }
    });
  }
});

/**
 * Synchronize the position and rotation of an entity with another.
 */
AFRAME.registerComponent("match-position-by-id", {
  schema: { default: '' },
  tick() {
    let obj;
    if (this.data === 'xr-camera') {
      const xrCamera = this.el.sceneEl.renderer.xr.getCameraPose();
      if (xrCamera) {
        this.el.object3D.position.copy(xrCamera.transform.position);
        this.el.object3D.quaternion.copy(xrCamera.transform.orientation);
        return;
      }
      obj = this.el.sceneEl.camera;
    } else {
      obj = document.getElementById(this.data)?.object3D;
    }
    if (obj) {
      this.el.object3D.position.copy(obj.position);
      this.el.object3D.quaternion.copy(obj.quaternion);
    }
  }
});

/**
 * Follow the XR camera's position.
 */
AFRAME.registerComponent("xr-follow", {
  tick() {
    const camera = this.el.sceneEl.camera;
    this.el.object3D.position.copy(camera.position);
    this.el.object3D.parent.worldToLocal(this.el.object3D.position);
  }
});

/**
 * Trigger exit on event.
 */
AFRAME.registerComponent("exit-on", {
  schema: { default: 'click' },
  update(oldEvent) {
    this.el.removeEventListener(oldEvent, this.exitVR);
    this.el.addEventListener(this.data, this.exitVR);
  },
  exitVR() {
    this.el.sceneEl.exitVR();
  }
});

/**
 * Apply physics once the model has loaded.
 * Prevent double registration.
 */
if (!AFRAME.components['physx-body-from-model']) {
  AFRAME.registerComponent("physx-body-from-model", {
    schema: { type: 'string', default: '' },
    init () {
      const details = this.data;
      this.onLoad = () => {
        this.el.setAttribute('physx-body', details);
        setTimeout(() => {
          this.el.setAttribute('physx-body', details);
        }, 100);
      };
      this.el.addEventListener('object3dset', this.onLoad);
    },
    remove () {
      this.el.removeEventListener('object3dset', this.onLoad);
    }
  });
}

/**
 * Handle pickup and drop physics.
 */
AFRAME.registerComponent("toggle-physics", {
  events: {
    pickup: function() {
      this.el.addState('grabbed');
    },
    putdown: function(e) {
      this.el.removeState('grabbed');
      const pose = e.detail.frame?.getPose(e.detail.inputSource.gripSpace);
      if (pose?.angularVelocity) {
        this.el.components['physx-body'].rigidBody.setAngularVelocity(pose.angularVelocity);
      }
      if (pose?.linearVelocity) {
        this.el.components['physx-body'].rigidBody.setLinearVelocity(pose.linearVelocity);
      }
    }
  }
});

/**
 * Replace window materials with custom reflective material.
 */
AFRAME.registerComponent('window-replace', {
  schema: { default: '' },
  init() {
    this.el.addEventListener('object3dset', this.update.bind(this));
    this.materials = new Map();
  },
  update() {
    const filters = this.data.trim().split(',');
    this.el.object3D.traverse((o) => {
      if (o.material && filters.some(f => o.material.name.includes(f))) {
        o.material = new THREE.MeshPhongMaterial({
          color: '#ffffff',
          transparent: true,
          side: THREE.DoubleSide,
          reflectivity: 0.6
        });
      }
    });
  }
});

/**
 * Main scene logic for building and AR interactions.
 */
window.addEventListener("DOMContentLoaded", function() {
  const sceneEl = document.querySelector("a-scene");
  const message = document.getElementById("dom-overlay-message");
  const building = document.getElementById("building");

  building.addEventListener('object3dset', function () {
    if (this.components.reflection) {
      this.components.reflection.needsVREnvironmentUpdate = true;
    }
  }, {once: true});

  sceneEl.addEventListener("enter-vr", function() {
    if (this.is("ar-mode")) {
      message.textContent = "Scanning environment...";
      this.addEventListener("ar-hit-test-start", () => message.textContent = "Finding surface...");
      this.addEventListener("ar-hit-test-achieved", () => message.textContent = "Tap to place object.");
      this.addEventListener("ar-hit-test-select", () => message.textContent = "Object placed.");
    }
  });

  sceneEl.addEventListener("exit-vr", function() {
    message.textContent = "Exited Immersive Mode";
  });
});
