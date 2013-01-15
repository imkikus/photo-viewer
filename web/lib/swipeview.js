/*!
 * SwipeView v1.0 ~ Copyright (c) 2012 Matteo Spinelli, http://cubiq.org
 * Released under MIT license, http://cubiq.org/license
 */
function InputHandler (vendor) {
	var self = this;
	var hasTouch = 'ontouchstart' in window;
	var resizeEvent = 'onorientationchange' in window ? 'orientationchange' : 'resize';
	var startEvent = hasTouch ? 'touchstart' : 'mousedown';
	var moveEvent = hasTouch ? 'touchmove' : 'mousemove';
	var endEvent = hasTouch ? 'touchend' : 'mouseup';
	var cancelEvent = hasTouch ? 'touchcancel' : 'mouseup';
	var transitionEndEvent = (function () {
		if ( vendor === false ) return false;

		var transitionEnd = {
			''			: 'transitionend',
			'webkit'	: 'webkitTransitionEnd',
			'Moz'		: 'transitionend',
			'O'			: 'oTransitionEnd',
			'ms'		: 'MSTransitionEnd'
		};

		return transitionEnd[vendor];
	})();

	function handleEvent (e) {
		var t = e.type;
		if (t == startEvent) dispatcher.fire('start', e, hasTouch ? e.touches[0] : e);
		else if (t == moveEvent) dispatcher.fire('move', e, hasTouch ? e.touches[0] : e);
		else if (t == cancelEvent) dispatcher.fire('end', e, hasTouch ? e.changedTouches[0] : e);
		else if (t == endEvent) dispatcher.fire('end', e, hasTouch ? e.changedTouches[0] : e);
		else if (t == resizeEvent) dispatcher.fire('resize', e);
		else if (t == transitionEndEvent) dispatcher.fire('transitionEnd', e);
	}

	var dispatcher = new Dispatcher();
	this.on = dispatcher.on;
	this.off = dispatcher.off;

	var wrapper;
	var slider;
	this.attach = function (newWrapper, newSlider) {
		if (wrapper || slider) this.detach();
		wrapper = newWrapper;
		slider = newSlider;
		window.addEventListener(resizeEvent, handleEvent, false);
		wrapper.addEventListener(startEvent, handleEvent, false);
		wrapper.addEventListener(moveEvent, handleEvent, false);
		wrapper.addEventListener(endEvent, handleEvent, false);
		slider.addEventListener(transitionEndEvent, handleEvent, false);
		return this;
	}

	this.detach = function () {
		window.removeEventListener(resizeEvent, handleEvent, false);
		wrapper.removeEventListener(startEvent, handleEvent, false);
		wrapper.removeEventListener(moveEvent, handleEvent, false);
		wrapper.removeEventListener(endEvent, handleEvent, false);
		slider.removeEventListener(transitionEndEvent, handleEvent, false);
		return this;
	}
}

// From http://fitzgeraldnick.com/weblog/26/ with slight modifications
function bind(thisCtx, name /*, variadic args to curry */) {
	var args = Array.prototype.slice.call(arguments, 2);
	return function () {
		return thisCtx[name].apply(thisCtx, args.concat(Array.prototype.slice.call(arguments)));
	};
}

// Mod in javascript is messed up for negative numbers.
function mod(a, b) {
	return ((a % b) + b) % b;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

var SwipeView = (function ($) {
	var dummyStyle = document.createElement('div').style;
	var vendor = (function () {
		var vendors = 't,webkitT,MozT,msT,OT'.split(',');
		var l = vendors.length;

		for (var i = 0 ; i < l; i++) {
			var t = vendors[i] + 'ransform';
			if (t in dummyStyle) {
				return vendors[i].substr(0, vendors[i].length - 1);
			}
		}

		return false;
	})();
	var cssVendor = vendor ? '-' + vendor.toLowerCase() + '-' : '';

	function addClass(el, classy) {
		$(el).addClass(classy);
	}

	function removeClass(el, classy) {
		$(el).removeClass(classy);
	}

		// Style properties
	var transform = prefixStyle('transform');
	var transitionDuration = prefixStyle('transitionDuration');

	function SwipeView (el) {
		var self = this;
		var wrapper = el;
		var slider;
		var len = 0;

		var dispatcher = new Dispatcher();
		self.on = dispatcher.on;
		self.off = dispatcher.off;

		function init () {
			wrapper.style.overflow = 'hidden';
			wrapper.style.postition = 'relative';

			self.masterPages = [];

			slider = document.createElement('div');
			var s = slider.style;
			s.position = 'relative';
			s.top = '0';
			s.height = '100%';
			s.width = '100%';
			s[cssVendor + 'transition-timing-function'] = 'ease-out';
			wrapper.appendChild(slider);

			self.refreshSize();

			for (var i = -1; i < 2; i++) {
				var page = document.createElement('div');
				var s = page.style;
				s.position = 'absolute';
				s.top = '0';
				s.height = '100%';
				s.width = '100%';
				s.left = i * 100 + '%';
				s.overflow = 'hidden';
				if (i == -1) s.visibility = 'hidden';

				page.dataset = {};
				var pageIndex = i == -1 ? len - 1 : i;
				page.dataset.pageIndex = pageIndex;
				page.dataset.upcomingPageIndex = pageIndex;

				slider.appendChild(page);
				self.masterPages.push(page);
			}

			addClass(self.masterPages[1], 'swipeview-active');

			var inputhandler = new InputHandler(vendor);
			inputhandler.attach(wrapper, slider);
			inputhandler.on('start', onStart);
			inputhandler.on('move', onMove);
			inputhandler.on('end', onEnd);
			inputhandler.on('resize', bind(self, 'refreshSize'));
			inputhandler.on('transitionEnd', onTransitionEnd);
			dispatcher.on('destroy', function () {
				inputhandler.detach();
			});

			self.currentMasterPage = 0;
			self.x = 0;
			self.page = 0;
			self.pageIndex = 0;
		}

		function deltaX () {
			return self.pointX - self.startX;
		}

		function deltaY () {
			return self.pointY - self.startY;
		}

		self.refreshSize = function () {
			self.pageWidth = wrapper.clientWidth;
			self.minX = (1 - len) * self.pageWidth;
			self.snapThreshold = Math.round(self.pageWidth * 0.15);
			slider.style[transitionDuration] = '0s';
			setPos(-self.page * self.pageWidth);
		}

		self.updatePageCount = function (n) {
			len = n;
			self.refreshSize();
		}

		self.goToPage = function (p) {
			var self = this;
			function positionMasters(a, b, c) {
				var m = self.masterPages;
				m[a].style.left = (p - 1) * 100 + '%';
				m[b].style.left = p * 100 + '%';
				m[c].style.left = (p + 1) * 100 + '%';

				m[a].dataset.upcomingPageIndex = p === 0 ? len - 1 : p - 1;
				m[b].dataset.upcomingPageIndex = p;
				m[c].dataset.upcomingPageIndex = p === len - 1 ? 0 : p + 1;
			}
			p = clamp(p, 0, len - 1);
			self.page = p;
			slider.style[transitionDuration] = '0s';
			setPos(-p * self.pageWidth);

			self.currentMasterPage = mod(self.page + 1, 3);

			if (self.currentMasterPage === 0) {
				positionMasters(2, 0, 1);
			} else if (self.currentMasterPage == 1) {
				positionMasters(0, 1, 2);
			} else {
				positionMasters(1, 2, 0);
			}

			flip();
		}

		self.destroy = function () {
			dispatcher.fire('destroy');
		}

		function setPos (x) {
			self.x = x;
			// translateZ(0) does not affect our appearance, but hints to the
			// renderer that it should hardware accelerate us, and thus makes
			// things much faster and smoother (usually). For reference, see:
			//     http://www.html5rocks.com/en/tutorials/speed/html5/
			slider.style[transform] = 'translateX(' + x + 'px) translateZ(0)';
		}

		function onStart (e, point) {
			if (self.initiated) return;

			self.initiated = true;
			self.moved = false;
			self.thresholdExceeded = false;
			self.startX = point.pageX;
			self.startY = point.pageY;
			self.pointX = point.pageX;
			self.pointY = point.pageY;
			self.directionLocked = false;

			slider.style[transitionDuration] = '0s';
		}

		function onMove (e, point) {
			if (!self.initiated) return;

			var dx = point.pageX - self.pointX;
			var newX = self.x + dx;
			if (newX > 0 || newX < self.minX) {
				newX = self.x + (dx / 2);
			}

			self.moved = true;
			self.pointX = point.pageX;
			self.pointY = point.pageY;
			var absX = Math.abs(deltaX());
			var absY = Math.abs(deltaY());

			// We take a 10px buffer to figure out the direction of the swipe
			if (absX < 10 && absY < 10) {
				return;
			}

			// We are scrolling vertically, so skip SwipeView and give the control back to the browser
			if (!self.directionLocked && absY > absX) {
				self.initiated = false;
				return;
			}

			e.preventDefault();

			self.directionLocked = true;

			if (absX >= self.snapThreshold) {
				self.thresholdExceeded = true;
			} else {
				self.thresholdExceeded = false;
			}

			setPos(newX);
		}

		function onEnd (e, point) {
			if (!self.initiated) return;

			self.pointX = point.pageX;
			var dist = Math.abs(deltaX());

			self.initiated = false;

			if (!self.moved) return;

			var realDist = dist;
			if (self.x > 0 || self.x < self.minX) {
				dist = 0;
				realDist /= 3;
			}

			if (dist < self.snapThreshold) {
				var val = Math.floor(300 * realDist / self.snapThreshold) + 'ms';
				slider.style[transitionDuration] = val;
				setPos(-self.page * self.pageWidth);
				return;
			}

			var moveMaster;
			var newMasterIndex;

			removeClass(self.masterPages[self.currentMasterPage], 'swipeview-active');

			var newPage;
			if (deltaX() > 0) {
				self.page = newPage = Math.floor(-self.x / self.pageWidth);
				self.currentMasterPage = mod(self.page + 1, 3);

				moveMaster = mod(self.currentMasterPage - 1, 3);
				self.masterPages[moveMaster].style.left = (self.page - 1) * 100 + '%';

				newMasterIndex = self.page - 1;
			} else {
				self.page = newPage = Math.ceil(-self.x / self.pageWidth);
				self.currentMasterPage = mod(self.page + 1, 3);

				moveMaster = mod(self.currentMasterPage + 1, 3);
				self.masterPages[moveMaster].style.left = (self.page + 1) * 100 + '%';

				newMasterIndex = self.page + 1;
			}
			newMasterIndex = mod(newMasterIndex, len);

			addClass(self.masterPages[self.currentMasterPage], 'swipview-active');
			addClass(self.masterPages[moveMaster], 'swipeview-loading');

			// Index to be loaded in the newly flipped page
			self.masterPages[moveMaster].dataset.upcomingPageIndex = newMasterIndex;

			newX = -self.page * self.pageWidth;

			slider.style[transitionDuration] = Math.floor(500 * Math.abs(self.x - newX) / self.pageWidth) + 'ms';

			self.masterPages[moveMaster].style.visibility = newX === 0 || newX == self.minX ? 'hidden' : '';

			setPos(newX);
		}

		function onTransitionEnd (e) {
			if (e.target && slider) flip();
		}

		function nextIndex (n) {
			return n === len ? 0 : n + 1;
		}

		function prevIndex (n) {
			return n === 0 ? len - 1 : n - 1
		}

		function flip () {
			dispatcher.fire('flip');

			for (var i = 0; i < 3; i++) {
				removeClass(self.masterPages[i], 'swipeview-loading');
				self.masterPages[i].dataset.pageIndex = self.masterPages[i].dataset.upcomingPageIndex;
			}
		}
		init(el);
	};

	function prefixStyle (style) {
		if ( vendor === '' ) return style;

		style = style.charAt(0).toUpperCase() + style.substr(1);
		return vendor + style;
	}

	return SwipeView;
})(Zepto);
