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

        push();
        rotate(this.angleContainer.value)
        line(0, 0, 0, -this.length);
        
        translate(0, -this.length);

        if (this.childExists) {
            this.slowerChildHand.draw();
            this.fasterChildHand.draw();
        }
        
        pop();
    }

}
