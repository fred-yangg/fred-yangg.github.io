class Hand {

    constructor(depth, maxDepth, angleContainer, length) {
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.angleContainer = angleContainer;
        this.length = length;
        this.childExists = false;
        
        if (depth < maxDepth) {
            this.childExists = true;
            var childDepth = this.depth + 1;
            var childLength = this.length * DOWNSCALE;
            this.slowerChildHand = new Hand(childDepth, this.maxDepth, secondAngle, childLength);
            this.fasterChildHand = new Hand(childDepth, this.maxDepth, minuteAngle, childLength);
        }
        
        
        this.draw();
    }


    draw() {

        ctx.save();
        ctx.translate(this.xStart, this.yStart);
        ctx.rotate(this.angleContainer.value)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -this.length);
        ctx.stroke();
        
        ctx.translate(0, -this.length);

        if (this.childExists) {
            this.slowerChildHand.draw();
            this.fasterChildHand.draw();
        }
        
        ctx.restore();
    }

}