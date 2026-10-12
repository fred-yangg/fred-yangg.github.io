# Height difference

Status: from your definition and answers. Not reviewed.

## What it is

Setting up a T-spin over a center well when the two sides of the well are at
different heights. A TSD over the well needs three things, in this order:

1. **Even heights.** The two columns next to the well are the same height. The
   T's arms rest on them, and the stem goes in the well.
2. **Fill in.** The rest of both sides is filled up to the T's arms, so the
   two rows the TSD clears are full apart from the T.
3. **Overhang.** A piece hangs over one of the arm cells.

A height difference puzzle starts with step 1 broken: the sides don't match.
You use pieces to even them out, fill in, build the overhang, and TSD.

```
TSD-ready slot over the well (fifth column)
.....S....
..L..SSJ..        <- overhang: the S hangs over the right arm
LLL...SJJJ        <- filled in, the T's arms go in the gap
IIII.#####        <- even heights: both neighbors end here
####.#####
####.#####        <- the well runs on below the TSD
```

Only the two columns next to the well have to match. The rest of each side
can be at any height up to the arms, and filling it in is step 2.

## Starting points

The well is one column wide at the bottom and can open wider above. It sits
anywhere from the third to the eighth column, so the sides are 2-7, 3-6, 4-5,
5-4, 6-3 or 7-2 wide.

Each side is flat with a rectangular notch taken out next to the well, from 1
column up to the whole side wide, and 0 to 3 rows deep. Every pair where the
two columns beside the well end up at different heights is a shape: 786 in
all, like a 2×2 notch out of the right side, or 1×3 on the left and 2×1 on
the right. The difference is the step between the two neighbors, 1 to 3 rows.

The trainer makes a puzzle from a shape when a TSD slot over the well can be
built from it with at most five pieces. Wide, deep notches need more and are
skipped.

Example, one row (I, L, J, S, T):

```
Start             Even heights      Fill in           Overhang          TSD               Result
..........        ..........        ..........        .....S....        .....S....        ..........
..........        ..........        ..L....J..        ..L..SSJ..        ..L..SSJ..        ..........
..........        ..........        LLL....JJJ        LLL...SJJJ        LLLTTTSJJJ        .....S....
.....#####        IIII.#####        IIII.#####        IIII.#####        IIIIT#####        ..L..SSJ..
####.#####        ####.#####        ####.#####        ####.#####        ####.#####        ####.#####
####.#####        ####.#####        ####.#####        ####.#####        ####.#####        ####.#####
```

Example, two rows (O, J, L, S, Z, T). The O evens the neighbor column, and the
other pieces fill in and make the overhang:

```
Start             Even heights      Ready             TSD               Result
..........        ..........        .....S....        .....S....        ..........
..........        ..........        ..Z..SSJ..        ..Z..SSJ..        ..........
..........        ..........        LZZ...SJJJ        LZZTTTSJJJ        .....S....
.....#####        ..OO.#####        LZOO.#####        LZOOT#####        ..Z..SSJ..
.....#####        ..OO.#####        LLOO.#####        LLOO.#####        LLOO.#####
####.#####        ####.#####        ####.#####        ####.#####        ####.#####
```

Same start as the first example, fixing only the neighbor column (I, J, L, O,
T). The L's foot evens the left neighbor, and the I fills in the right side
instead:

```
Ready             TSD               Result
.....J....        .....J....        ..........
..L..JJJ..        ..L..JJJ..        ..........
OOL...IIII        OOLTTTIIII        .....J....
OOLL.#####        OOLLT#####        ..L..JJJ..
####.#####        ####.#####        ####.#####
####.#####        ####.#####        ####.#####
```

In the first two examples the S both fills in the right side and makes the
overhang, so steps 2 and 3 overlap. All three were checked with the solver.

## Pieces

- The fix depends on the difference and the shapes: see the table above.
- Fixing the neighbor column alone is often enough, as in the third example.
- S and Z are the usual overhang over the well, because they fill in one side
  and hang over the arm in one piece.
- A T. With a bad bag, you may have to keep stacking evenly and wait for the
  next one.
- Not a T for the overhang or the fill. That wastes a T, and the trainer calls
  it a wrong move. The pieces before the T are always enough without one.

## What it leaves

Two rows clear and the well is open again below. Whatever was above the T's
rows stays, so the next TSD starts with a new height difference. All three
results above leave the right neighbor two rows higher.

## How the trainer tests it

- **Start:** one of the shapes above, in gray, with a preview a 7-bag could
  deal: the pieces that build the slot (never a T), and the T.
- **Goal:** a TSD with its T in the well. A T placed any other way is wasted
  and counts as a wrong move.
- **Finish:** the cleanest board any solution leaves: no holes, the well still
  open, the next height difference as small as it can be, then the flattest
  stack. Finishes within 2 of the flattest count too. Some other finish always
  leaves a hole or covers the well, so the clean one takes finding.
- **Categories:** "Height difference", split into 1, 2 and 3 rows: 29, 29
  and 2 puzzles, about five per step size for each well column. Few 3-row
  shapes fit in five pieces without a T.
- For 3-row differences, the TSD can sit a row above the higher side. TSTs and
  TSSs aren't generated yet.

## Questions

- Are the notch shapes the right family, or do you also see bumps (one side
  higher right next to the well) and stairs?
- For big differences, which TST or TSS shapes do you reach for?

## Examples from play

None yet. Add fumen links here.
