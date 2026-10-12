# Mid-game techniques

Notes on the mid-game techniques the trainer turns into puzzles: what each one
is, when to use it, and what it grows from. Puzzles should come from these
notes, so a wrong note means wrong puzzles. Edit them freely.

Openers and perfect clears (PCO, DPC, SDPC, MS2) aren't covered here. Their
setups are exact shapes taken from four.lol and the Hard Drop wiki, and the
puzzles already check them exactly.

## Status

| Technique | File | Status |
| --- | --- | --- |
| Kaidan | [kaidan.md](kaidan.md) | Draft, from four.lol and Hard Drop |
| Fractal | [fractal.md](fractal.md) | Draft, from four.lol and Hard Drop |
| STSD | [stsd.md](stsd.md) | Draft, from four.lol and Hard Drop |
| Donation | [donation.md](donation.md) | Draft, from four.lol |
| TST setups | [tst.md](tst.md) | Draft, from four.lol |
| Height difference | [height-difference.md](height-difference.md) | From your definition and answers |

Change a status to "Reviewed" once a file matches how you play.

## What each file covers

1. **What it is.** The shape and spin that make it this technique and not
   another. This is what a puzzle's goal checks.
2. **When to use it.** The board features that call for it, and when something
   else is better. Puzzles should include both kinds of positions.
3. **Starting points.** Boards it commonly grows from in real games. Puzzles
   start from boards like these, not from a diagram with pieces removed.
4. **Pieces.** Which pieces build it, in what order, and what to do with a bad
   bag.
5. **What it leaves.** The board after the spins, and the usual follow-up.
   Puzzles require this "ideal finish".
6. **How the trainer should test it.** The puzzle spec.
7. **Questions.** Things the sources don't settle.

## Board notation

Rows run top to bottom, ten columns, like the puzzle boards in the code.

| Mark | Meaning |
| --- | --- |
| `.` | Empty |
| `#` | Stack that's already there |
| `I J L O S Z` | Pieces placed for this technique |
| `T` | The spinning T where it locks |
| `t` | A T placed earlier, as part of the stack |
| `x` | A cell the note points at |

## How to help

- Correct anything that's wrong, right in the file.
- Add real examples under **Examples from play**: a fumen link, what the board
  was, and what you'd do. A handful per technique is enough to change how the
  generator works.

## How puzzles are made

Each technique has a generator in `techniques.ts` that draws a stack at one
of the starting points in these notes, built from real pieces, and deals a
preview a 7-bag could give: the pieces the technique needs, the T, and
sometimes a spare.

- **Kaidan:** stairs down to an open column, at the edge or in the middle,
  sometimes with the overhang already there. The preview has the S or Z.
- **Donation:** an open column with a TSD slot beside it whose rows cross the
  column. The preview has the piece that covers it (O, J or L).
- **Fractal:** two stacked TSD slots, with the top two or three pieces taken
  back.
- **STSD:** a 3×3 space beside the stack, sometimes over a Tetris column. The
  preview has the J (or L) for the notch and a piece for the overhang.
- **TST setups:** a one-cell notch at the bottom of a 3-wide gap, or a stack
  stepping down twice into a well.
- **Height difference:** every notch shape in
  [height-difference.md](height-difference.md).

The solver then finds every way to make the spins. The ideal finish is the
cleanest board any of them leaves: no holes under pieces you placed, the open
column still open, then the flattest stack (within 2). Holes the stack already
had don't count, and neither does the one a TST leaves under its overhang. Any finish that clean passes, technique or not. If one of the
ideal finishes uses the technique, the puzzle teaches it. If none does, it's a
**wrong call**: the board looks right, but the piece isn't coming or something
else is cleaner. After a solve, the trainer says which.

Every puzzle has a clean finish and at least one that leaves a hole or covers
the open column, so the clean one takes finding. A puzzle where every finish
is messy is dropped.

A T that locks without the T-spin the goal wants next is wasted, and the
trainer calls it a wrong move. The pieces the preview brings to build a slot
never include a T, so there's always a way that doesn't waste one.

How each technique is recognized:

| Technique | Counts when |
| --- | --- |
| Kaidan | The TSD clears rows where an S or Z covered the open column, and the column is open after |
| Donation | The TSD clears every row where a piece covered the open column, and the column is open after |
| Fractal | Two TSDs in the same column, the second right under the first |
| STSD | The first TSD's T is sideways, and the second TSD is next to it |
| TST setups | Any TST |
| Height difference | The TSD's T is in the well |
