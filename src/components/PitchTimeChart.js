import React from 'react';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { select } from 'd3-selection';
import View from '../lib/ui/View';
import { flattenArray } from '../lib/utils/ArrayUtils';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { drawNoteTrapezoid, setupCanvas, clipLeftRight } from '../lib/ui/Graphics';
import { getMidiNoteByNr, isSharp } from '../lib/Midi';
import { swapSoSmallerFirst, clipValue } from '../lib/utils/MathUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';


export default class PitchTimeChart extends View {

    constructor(props) {
        const margin = { top: 35, right: 20, bottom: 40, left: 55 };
        super(props, margin);
        this.state = {
            ...this.state,
            overviewHeight: 80,
            showAllTime: false,
            selectedTrack: 'all',
            // pitch, note, drums
            yAxisLabelType: 'pitch',
            boxHeight: null,
            notes: [],
            liveNotes: [],
        };
    }

    componentDidMount = () => this.initialize();

    onResize = () => this.initialize();

    componentDidUpdate() {
        this.resizeComponent();
        if (this.state.initialized) {
            this.draw();
        }
    }

    initialize = () => {
        const { width, height, overviewHeight, yAxisLabelType } = this.state;
        const svg = select(this.svg);
        svg.selectAll('*').remove();
        // Scales
        const x = scaleLinear().range([2, width]);
        const xOv = scaleLinear().range([2, width]);
        const y = scaleLinear().range([height, overviewHeight + 25]);
        const yOv = scaleLinear().range([overviewHeight, 0]);
        // Axes
        const xAxis = axisBottom(x);
        const yAxis = axisLeft(y);
        if (yAxisLabelType === 'note') {
            yAxis.tickFormat(d => getMidiNoteByNr(d)?.label);
        }
        const xAxisEl = svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0, ${height})`)
            .call(xAxis);
        const yAxisEl = svg.append('g')
            .attr('class', 'axis')
            .call(yAxis);
        // Labels
        svg.append('text')
            .attr('class', 'yAxisLabel')
            .text('Pitch')
            .attr('transform', `rotate(90) translate(${(height + overviewHeight) / 2}, ${45})`);
        // Setup canvas rescaled to device pixel ratio
        setupCanvas(this.canvas);
        setupCanvas(this.highlightCanvas);
        this.setState({ initialized: true, svg, x, xOv, y, yOv, xAxis, yAxis, xAxisEl, yAxisEl });
    }

    /**
     * Draws the note retangles.
     * @param {CanvasRenderingContext2D} ctx canvas rendering context
     * @param {Notes[]} notes notes with start, end, pitch
     * @param {number} boxHeight height of each pitch-line
     * @param {Function} x D3 linearScale x scale
     * @param {Function} y D3 linearScale y scale
     */
    drawNotes = (ctx, notes, boxHeight, x, y) => {
        const { width, margin } = this.state;
        const veloScale = scaleLinear()
            .domain([0, 127])
            .range([boxHeight * 0.1, boxHeight]);
        for (let note of notes) {
            const startPos = x(note.start);
            const endPos = x(note.end);
            // Do not draw invisible notes
            if (endPos < 0 || startPos > width) {
                continue;
            }
            const xPos = margin.left + startPos;
            // TODO: encode velocity in height?
            const h = veloScale(note.velocity);
            const yPos = margin.top + y(note.pitch) - h / 2;
            const w = Math.max(endPos - startPos, 1);
            drawNoteTrapezoid(ctx, xPos, yPos, w, h, h / 2);
        }
    }

    /**
     * Main drawing function
     */
    draw = () => {
        const { viewWidth, viewHeight, margin, width, height, overviewHeight, x, xOv, y, yOv, xAxis, yAxis, xAxisEl, yAxisEl, selectedTrack, showAllTime } = this.state;
        const { midiFileData, timeSelection } = this.props;
        // Prepare main and highlight canvas
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, viewWidth, viewHeight);
        const ctx2 = this.highlightCanvas.getContext('2d');
        ctx2.clearRect(0, 0, viewWidth, viewHeight);

        // Get notes
        let track;
        let allNotes = [];
        if (midiFileData && midiFileData.length > 0) {
            if (selectedTrack === 'all') {
                // Show all tracks
                allNotes = flattenArray(midiFileData);
            } else {
                // Show selected track
                track = Math.min(selectedTrack, midiFileData.length - 1);
                allNotes = midiFileData[track];
            }

        }
        if (allNotes.length === 0) {
            return;
        }

        // Set x scale domain
        const [start, end] = extent(allNotes, d => d.end);
        const xDomain = [start < 0 ? start : 0, end];
        xOv.domain(xDomain);
        if (showAllTime) {
            // Show all notes
            x.domain(xDomain);
        } else {
            let interval = [0, end];
            if (timeSelection) {
                interval = timeSelection;
            }
            x.domain(interval);
        }
        xAxisEl.call(xAxis);
        // Set y scale domain
        const [low, high] = extent(allNotes, d => d.pitch);
        y.domain([+low - 1, +high + 1]);
        yOv.domain([+low - 1, +high + 1]);
        yAxisEl.call(yAxis);
        // If only one track, use color for channels
        // and allow to only show a single channel
        let tracks = selectedTrack === 'all' ? midiFileData : [midiFileData[track]];

        // Draw background bands and measure lines
        this.drawRowBandsForSharps(ctx, margin, y, low, high, width, 'rgba(128, 128, 128, 0.15)');
        this.drawMeasures(ctx);

        // Draw notes onto canvas
        const colors = schemeCategory10;
        const boxHeight = height / (high - low + 3);
        const boxHeight2 = overviewHeight / (high - low + 1);
        tracks.forEach((tr, i) => {
            ctx.fillStyle = colors[i % colors.length];
            this.drawNotes(ctx, tr, boxHeight, x, y);
            this.drawNotes(ctx, tr, boxHeight2, xOv, yOv);
        });

        // Separator between overview and main visualization
        ctx.fillStyle = '#888';
        ctx.fillRect(margin.left, margin.top + overviewHeight + 12, width, 1);
        clipLeftRight(ctx, margin, width, height);

        // Draw time selection and similar sections
        if (timeSelection) {
            const [start, end] = timeSelection;
            this.drawTimeSelection(ctx2, start, end, 'rgba(70, 130, 180, 0.2)');
        }
        // Draw current player time
        this.drawCurrentPlayerTime(ctx2);
    }

    /**
     * Draws horizontal bands with alternating color to better distinguish rows.
     * @param {CanvasRenderingContext2D} ctx canvas rendering context
     */
    drawRowBandsForSharps = (ctx, margin, y, low, high, width, fillStyle = 'rgba(128, 128, 128, 0.1)') => {
        const oldFill = ctx.fillStyle;
        ctx.fillStyle = fillStyle;
        const rowHeight = y(0) - y(1);
        const xPos = margin.left;
        for (let pitch = low - 1; pitch <= high + 1; pitch++) {
            // Only draw for shaprs
            if (isSharp(pitch)) {
                const yPos = margin.top + y(pitch) - rowHeight / 2;
                ctx.fillRect(xPos, yPos, width, rowHeight);
            }
        }
        ctx.fillStyle = oldFill;
    }

    /**
     * Draws measure lines (not on the overview)
     * @param {CanvasRenderingContext2D} ctx canvas rendering context
     */
    drawMeasures = (ctx) => {
        const { xmlFileData, selectedTrack } = this.props;
        const { margin, width, height, overviewHeight, x } = this.state;
        if (!xmlFileData) { return; }
        const part = xmlFileData.parts[selectedTrack === 'all' ? 0 : selectedTrack];
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        const yPos = margin.top + overviewHeight + 20;
        const h = height - overviewHeight - 20;
        for (let p of part.measureLinePositions) {
            const pos = x(p);
            if (pos <= 0 || pos > width) { continue; }
            ctx.fillRect(margin.left + pos, yPos, 1, h);
        }
    }

    /**
     * Draws the current player time (from props) onto the highlight canvas.
     */
    drawCurrentPlayerTime = (ctx) => {
        const { margin, height, overviewHeight, x, xOv } = this.state;
        const { currentPlayerTime } = this.props;
        if (currentPlayerTime === null) { return; }
        ctx.fillStyle = 'steelblue';
        ctx.fillRect(margin.left + xOv(currentPlayerTime), margin.top, 2, overviewHeight);
        ctx.fillRect(margin.left + x(currentPlayerTime), margin.top + overviewHeight + 25, 2, height - overviewHeight - 25);
    }

    /**
     * Draws the current time selection (from props) onto the highlight canvas.
     */
    drawTimeSelection = (ctx, start, end, fill) => {
        const { margin, height, overviewHeight, x, xOv } = this.state;
        ctx.fillStyle = fill;
        const xOv1 = margin.left + xOv(start);
        const xOv2 = margin.left + xOv(end);
        ctx.fillRect(xOv1, margin.top, xOv2 - xOv1, overviewHeight);
        const x1 = margin.left + x(start);
        const x2 = margin.left + x(end);
        ctx.fillRect(x1, margin.top + overviewHeight + 25, x2 - x1, height - overviewHeight - 25);
    }

    /**
     * Sets the new player start time
     * @param {MouseEvent} e React onClick event
     */
    handleBrushed = (e) => {
        const { margin, overviewHeight, xOv, brushStartEvent } = this.state;
        const { setTimeSelection } = this.props;
        if (!e || !brushStartEvent) { return; }
        const { offsetX: startX, offsetY: startY } = brushStartEvent;
        const { offsetX: endX } = e.nativeEvent;
        // See if start position is in overview
        if (startY < margin.top || startY > margin.top + overviewHeight) {
            return;
        }
        // Get time
        let startTime = xOv.invert(startX - margin.left);
        let endTime = xOv.invert(endX - margin.left);
        // Clip to domain
        const [minTime, maxTime] = xOv.domain();
        startTime = clipValue(startTime, minTime, maxTime);
        endTime = clipValue(endTime, minTime, maxTime);
        const sorted = swapSoSmallerFirst(startTime, endTime);
        // Make selection at least 1 second wide
        if (sorted[1] - sorted[0] < 1) {
            sorted[1] = sorted[0] + 1;
        }
        // Set selection in App.js
        setTimeSelection(sorted);
    }

    render() {
        const { viewWidth, viewHeight, margin } = this.state;
        const { midiFileData, selectedTrack } = this.props;
        // HTML
        return (
            <div
                className='View PitchTimeChart'
                style={{ gridArea: `span ${this.state.rowSpan} / span ${this.state.columnSpan}` }}
            >
                <canvas
                    className='ViewCanvas'
                    ref={n => this.canvas = n}
                    style={{ width: viewWidth, height: viewHeight }}
                    onMouseDownCapture={(e) => this.setState({ brushStartEvent: e.nativeEvent })}
                    onMouseUpCapture={this.handleBrushed}
                />
                <canvas
                    className='ViewCanvas HighlightCanvas'
                    ref={n => this.highlightCanvas = n}
                    style={{ width: viewWidth, height: viewHeight }}
                />
                <svg
                    width={viewWidth}
                    height={viewHeight}
                >
                    <text
                        className='heading'
                        x={viewWidth / 2}
                        y={20}
                    >
                        MIDI Piano Roll
                    </text>
                    <g
                        ref={n => this.svg = n}
                        transform={`translate(${margin.left}, ${margin.top})`}
                    />
                    <text
                        className='yAxisLabel'
                        x={viewWidth / 2}
                        y={viewHeight - 5}
                    >
                        Time in seconds
                    </text>
                </svg>
                <div className='viewControls'>
                    <select
                        title='MIDI track(s)'
                        onChange={(e) => this.setState({ selectedTrack: e.target.value })}
                        disabled={midiFileData.length > 1 && selectedTrack === 'all'}
                    >
                        <option key='all' value='all'>All tracks</option>
                        {new Array(midiFileData.length).fill(0).map((_, i) => (
                            <option
                                key={i}
                                value={i}
                                style={{ background: schemeCategory10[i % schemeCategory10.length] }}
                            >
                                Track {i}
                            </option>
                        ))}
                    </select>
                    <select
                        title='Y-axis labels'
                        onChange={(e) => this.setState({ yAxisLabelType: e.target.value }, this.initialize)}
                    >
                        <option value='pitch'>MIDI note</option>
                        <option value='note'>Note name</option>
                    </select>
                    <button
                        title='Toggles between showing the whole time or a selection in the lower part'
                        onClick={() => this.setState({ showAllTime: !this.state.showAllTime })}
                    >
                        <FontAwesomeIcon icon={this.state.showAllTime ? faToggleOn : faToggleOff} />&nbsp;
                        Show whole time
                    </button>
                </div>
            </div>
        );
    }
}
