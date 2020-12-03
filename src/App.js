import React, { Component } from 'react';
import './style/App.css';
import MidiParser from 'midi-parser-js';
import PitchTimeChart from './components/PitchTimeChart';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { preprocessMidiFileData } from 'musicvis-lib';


export default class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            viewSize: {
                outerWidth: 800,
                outerHeight: 600
            },
            midiFileData: [],
            timeSelection: null
        };
    }

    componentDidMount() {
        // Scale layout to current screen size
        window.addEventListener('resize', this.onResize, false);
        this.onResize();

        // select the INPUT element that will handle
        // the file selection.
        let source = document.getElementById('filereader');
        // provide the File source and a callback function
        const _this = this;
        MidiParser.parse(source, function (obj) {
            try {
                const parsed = preprocessMidiFileData(obj);
                const parts = parsed.parts.map(d => d.noteObjs);
                _this.setState({ midiFileData: parts });
            } catch (e) {
                alert('Invalid MIDI file or wrong format!');
            }
        });
    }

    /**
     * Updates the size state when the window size changes
     * so views can react and redraw
     */
    onResize = () => {
        this.setState({
            viewSize: {
                outerWidth: Math.floor(window.innerWidth - 20),
                outerHeight: Math.floor(window.innerHeight - 200)
            }
        });
    }

    /**
     * Changes the current time selection
     * @param {number[]} timeSelection [start, end] in seconds
     */
    setTimeSelection = (timeSelection) => {
        this.setState({ timeSelection, similarSections: [] });
    };

    render() {
        const s = this.state;
        return (
            <div className={`App dark`} >
                <div className='fileSelection'>
                    <input
                        className='fileInput'
                        type='file'
                        id='filereader'
                    />
                </div>
                <PitchTimeChart
                    name='Note-Time Chart'
                    viewSize={s.viewSize}
                    midiFileData={s.midiFileData}
                    timeSelection={s.timeSelection}
                    setTimeSelection={this.setTimeSelection}
                />
                <div className='githubLink'>
                    <a href='https://github.com/fheyen/midi-pianoroll'>
                        <FontAwesomeIcon icon={faGithub} />&nbsp;
                        https://github.com/fheyen/midi-pianoroll
                    </a>
                </div>
            </div >
        );
    }
}
