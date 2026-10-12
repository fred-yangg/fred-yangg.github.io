# Donation

Status: draft, not reviewed.
Source: [four.lol](https://four.lol/mid-game/donation).

## What it is

Covering an open column (or hole) for a moment with the pieces of a T-spin
setup, so that the T-spin's line clear uncovers it again. Back-to-Back is
kept, and the lines under the cover stay as they were.

```
Before            Setup on top      TSD               After the clear
##........        IIIII.....        IIIII.....        ..........
#####.#.##        ##II...III        ##IITTTIII        IIIII.....
#####.#.##        #####.#I##        #####T#I##        #####.#.##
#####.####        #####.#.##        #####.#.##        #####.####
                  #####.####        #####.####
```

An I covers the right-hand hole and the T sits over the left one. When the
TSD clears its two rows, both holes are open again.

The rule that makes it work: of the cells you fill above the covered column,
only the ones in rows the T-spin will clear can go there. In four.lol's
example, no more than two cells on the covered column, or the hole stays
covered after the T-spin.

Kaidan is a donation with an S/Z as the cover. STSDs can donate too: the rows
the second TSD clears can be filled later, so the first TSD can use a
donation.

A float (four.lol's "air T-spin") is a close cousin. In a donation the stack
hovers over the covered column and the T-spin uncovers it. In a float, the
T-slot itself hangs over empty space, rather than the stack around it. The
trainer counts both as donations and has no separate category for floats.

## When to use it

- You want a T-spin, but the obvious setup would fill a column you want to
  keep (a Tetris well, or clean garbage lines underneath, as in Parapet).
- You're short on pieces. The covered cells don't need filling, so the T-spin
  shape takes fewer pieces.
- It gives another way to arrange the pieces you have.

When not to use it:

- The queue doesn't fit the donation. Four.lol's third example queue has to
  rethink the donation, and conventional stacking ends up cleaner.
- Overused, donations make the stack unstable.

## Starting points

1. **A stack with an open column** (garbage hole or Tetris well) and room for
   a TSD slot over it.
2. **Holes from garbage** that a TSD above can uncover.
3. **Parapet**, which keeps clean garbage lines underneath.

## Pieces

Step 1 (four.lol): picture the T-spin's base and overhang, and which lines it
will clear.
Step 2: look at the queue and see whether a donation fits. If not, picture a
different donation and check again.

Four.lol's example queues on the same board: S I Z T O works, Z J L T works,
S J I T T needs a different plan.

## What it leaves

The covered column or hole is open again, and the T-spin's rows are gone.
Anything you put above the covered cells outside the cleared rows stays, so
the cover has to be planned around the clear.

## How the trainer should test it

- **Start:** a stack with an open column or hole, a random preview with a T
  in reach, and a T-spin that can be built over the column.
- **Goal:** a T-spin that leaves the column or hole uncovered (the ideal
  board).
- **Wrong-call positions:** queues where no donation fits and plain stacking
  is cleaner, and queues where the donation would leave the hole covered.
- **Built so far:** an open column with an O, J or L as the cover. No wrong
  calls: with the cover swapped out, no other TSD fits these boards. Not yet:
  garbage holes, Parapet, covers made of two pieces, and real wrong calls.

## Questions

- Which donations do you use most besides Kaidan?
- Should the trainer count any T-spin that uncovers a hole as a donation, or
  only specific named shapes?
- Is Parapet worth its own subcategory?

## Examples from play

None yet. Add fumen links here.
