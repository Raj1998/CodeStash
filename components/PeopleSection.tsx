import type { Person } from "@/types";
import { PersonChip } from "@/components/PersonChip";

interface PeopleSectionProps {
  people: Person[];
  personName: string;
  personNameInputRef: React.RefObject<HTMLInputElement>;
  onPersonNameChange: (value: string) => void;
  onAddPerson: () => void;
  onRemovePerson: (person: Person) => void;
}

export function PeopleSection({
  people,
  personName,
  personNameInputRef,
  onPersonNameChange,
  onAddPerson,
  onRemovePerson,
}: PeopleSectionProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">People</h2>
          <p className="text-sm text-slate-500">
            Add each friend once, then tap their chip to remove them.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          {people.length} {people.length === 1 ? "person" : "people"}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            ref={personNameInputRef}
            value={personName}
            onChange={(event) => onPersonNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddPerson();
              }
            }}
            placeholder="Add a person"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={onAddPerson}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Add
          </button>
        </div>

        {people.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <PersonChip
                key={person.id}
                person={person}
                showRemove
                onClick={() => onRemovePerson(person)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Start by adding everyone at the table.
          </div>
        )}
      </div>
    </section>
  );
}
