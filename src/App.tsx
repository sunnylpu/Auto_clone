import { useState,listOptions } from "react";

import Header from "./components/Header";
import SelectField from "./components/SelectField";
import InputField from "./components/InputField";
import PrimaryButton from "./components/PrimaryButton";
import CardPreview from "./components/CardPreview";

import {
  repeatOptions,
  durationOptions,
  positionOptions,
} from "./data/options";

function App() {

  const [repeat, setRepeat] = useState("Weekly");

  const [duration, setDuration] = useState("2 Weeks");

  const [position, setPosition] = useState("Top");

  const [list, setList] = useState("To Do");

  return (
    <div className="min-h-screen bg-[#1D2125] flex items-center justify-center p-4">

      <div className="w-[340px] animate-[popup_0.25s_ease] bg-[#282E33] border border-[#3B444C] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-4 text-white">

        <Header />
        <CardPreview />
        <SelectField
          label="Repeat"
          value={repeat}
          options={repeatOptions}
          onChange={setRepeat}
        />

        <InputField
          label="Time"
          type="time"
        />

        <InputField
          label="Date"
          type="date"
        />

        <SelectField
          label="Duration"
          value={duration}
          options={durationOptions}
          onChange={setDuration}
        />

        <SelectField
          label="Position"
          value={position}
          options={positionOptions}
          onChange={setPosition}
        />
        <SelectField
          label="Target List"
          value={list}
          options={listOptions}
          onChange={setList}
        />
        <PrimaryButton loading={false} />

      </div>

    </div>
  );
}

export default App;