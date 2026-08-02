/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LoggingConsoleField, DEFAULT_LOGGING_FIELDS } from '../types';
import { 
  Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown, Save, 
  RotateCcw, Eye, EyeOff, Sliders, Layers, List, Settings2, Info, Sparkles
} from 'lucide-react';

export const PotteryLoggingConsoleSettings: React.FC = () => {
  const { loggingFields, updateLoggingFields } = useApp();

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add field form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<LoggingConsoleField['type']>('short_text');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newEnabled, setNewEnabled] = useState(true);
  const [newOptionsStr, setNewOptionsStr] = useState('');

  // Edit field state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<LoggingConsoleField['type']>('short_text');
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');

  // Delete modal confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Field reorder helper
  const handleMoveField = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= loggingFields.length) return;
    
    const reordered = [...loggingFields];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    await updateLoggingFields(reordered);
    triggerToast('Field order updated');
  };

  // Toggle enable
  const handleToggleEnabled = async (field: LoggingConsoleField) => {
    const updated = loggingFields.map(f => f.id === field.id ? { ...f, enabled: !f.enabled } : f);
    await updateLoggingFields(updated);
    triggerToast(`Field "${field.label}" ${!field.enabled ? 'enabled' : 'disabled'}`);
  };

  // Toggle required
  const handleToggleRequired = async (field: LoggingConsoleField) => {
    const updated = loggingFields.map(f => f.id === field.id ? { ...f, required: !f.required } : f);
    await updateLoggingFields(updated);
    triggerToast(`Field "${field.label}" ${!field.required ? 'marked required' : 'marked optional'}`);
  };

  // Submit Add Field
  const handleAddFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const slugKey = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const options = (newType === 'dropdown' || newType === 'multi_select')
      ? newOptionsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const newField: LoggingConsoleField = {
      id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      key: slugKey || `field_${Date.now()}`,
      label: newLabel.trim(),
      type: newType,
      placeholder: newPlaceholder.trim(),
      required: newRequired,
      enabled: newEnabled,
      order: loggingFields.length + 1,
      options
    };

    await updateLoggingFields([...loggingFields, newField]);
    setNewLabel('');
    setNewPlaceholder('');
    setNewOptionsStr('');
    setNewRequired(false);
    setShowAddForm(false);
    triggerToast('New field added to console');
  };

  // Start Edit Field
  const handleStartEdit = (field: LoggingConsoleField) => {
    setEditingFieldId(field.id);
    setEditLabel(field.label);
    setEditType(field.type);
    setEditPlaceholder(field.placeholder || '');
    setEditRequired(field.required);
    setEditEnabled(field.enabled);
    setEditOptions(field.options || []);
    setNewOptionInput('');
  };

  // Save Edit Field
  const handleSaveEdit = async () => {
    if (!editingFieldId || !editLabel.trim()) return;

    const updated = loggingFields.map(f => {
      if (f.id === editingFieldId) {
        return {
          ...f,
          label: editLabel.trim(),
          type: editType,
          placeholder: editPlaceholder.trim(),
          required: editRequired,
          enabled: editEnabled,
          options: (editType === 'dropdown' || editType === 'multi_select') ? editOptions : undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return f;
    });

    await updateLoggingFields(updated);
    setEditingFieldId(null);
    triggerToast('Field updated successfully');
  };

  // Delete field
  const handleDeleteField = async (id: string) => {
    const updated = loggingFields.filter(f => f.id !== id);
    await updateLoggingFields(updated);
    setDeleteTargetId(null);
    triggerToast('Field removed from console configuration');
  };

  // Reset to default
  const handleResetDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all Pottery Logging Console fields to the system defaults? Custom fields will be reset.')) {
      await updateLoggingFields(DEFAULT_LOGGING_FIELDS);
      triggerToast('Console fields reset to default settings');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-brand-charcoal text-brand-cream text-xs font-bold py-3.5 px-6 rounded-xl border border-brand-clay/30 shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <Check className="h-4 w-4 text-brand-sage" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-brand-clay/60 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-brand-charcoal">Pottery Logging Console Fields</h2>
            <span className="bg-brand-sand text-brand-terracotta text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">Live Dynamic Schema</span>
          </div>
          <p className="text-xs text-brand-charcoal/70 mt-1 max-w-2xl">
            Configure the form fields, labels, placeholders, input types, and dropdown options used inside the Pottery Logging Console card on the Pottery Pieces page. Changes immediately update staff piece logging across the system.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-brand-sand/60 hover:bg-brand-sand text-brand-charcoal rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Custom Field</span>
          </button>
        </div>
      </div>

      {/* ADD NEW FIELD FORM */}
      {showAddForm && (
        <form onSubmit={handleAddFieldSubmit} className="bg-brand-sand/30 border-2 border-brand-terracotta/40 rounded-3xl p-6 space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-brand-clay/40 pb-3">
            <h3 className="font-display font-bold text-sm text-brand-charcoal flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-terracotta" />
              <span>Add New Pottery Console Field</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="p-1 rounded-lg text-brand-charcoal/60 hover:bg-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-brand-charcoal/70 block">Field Label *</label>
              <input
                type="text"
                required
                placeholder="e.g. Clay Body Type, Glaze Finish..."
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-brand-charcoal/70 block">Input Type *</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as any)}
                className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
              >
                <option value="short_text">Short Text</option>
                <option value="long_text">Long Text (Textarea)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Select Dropdown</option>
                <option value="multi_select">Multi-Select Chips</option>
                <option value="customer">Customer Selector</option>
                <option value="staff">Staff Selector</option>
                <option value="workshop">Workshop Selector</option>
                <option value="status">Status Selector</option>
                <option value="piece_code">Piece Code</option>
                <option value="image">Photo Capture & Preview</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-brand-charcoal/70 block">Placeholder Text</label>
              <input
                type="text"
                placeholder="e.g. Enter specific instructions..."
                value={newPlaceholder}
                onChange={e => setNewPlaceholder(e.target.value)}
                className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal"
              />
            </div>
          </div>

          {(newType === 'dropdown' || newType === 'multi_select') && (
            <div className="space-y-1 text-xs">
              <label className="font-bold text-brand-charcoal/70 block">Selectable Options (Comma-separated)</label>
              <input
                type="text"
                placeholder="Option 1, Option 2, Option 3..."
                value={newOptionsStr}
                onChange={e => setNewOptionsStr(e.target.value)}
                className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal"
              />
              <p className="text-[10px] text-brand-charcoal/50">Separate each dropdown option with a comma.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-6 text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={e => setNewRequired(e.target.checked)}
                  className="rounded border-brand-clay text-brand-terracotta focus:ring-brand-terracotta"
                />
                <span>Required Field</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEnabled}
                  onChange={e => setNewEnabled(e.target.checked)}
                  className="rounded border-brand-clay text-brand-terracotta focus:ring-brand-terracotta"
                />
                <span>Enabled (Visible)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white hover:bg-brand-sand text-brand-charcoal rounded-xl text-xs font-bold border border-brand-clay transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Save Field
              </button>
            </div>
          </div>
        </form>
      )}

      {/* FIELDS LIST TABLE / CARDS */}
      <div className="bg-white border border-brand-clay/60 rounded-3xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-brand-clay/30 bg-brand-cream flex justify-between items-center">
          <span className="font-display font-bold text-sm text-brand-charcoal">Active Field Schema Sequence ({loggingFields.length} fields)</span>
          <span className="text-[11px] font-semibold text-brand-charcoal/50">Drag or use arrow buttons to reorder</span>
        </div>

        <div className="divide-y divide-brand-clay/20">
          {loggingFields.map((field, idx) => {
            const isEditing = editingFieldId === field.id;

            if (isEditing) {
              return (
                <div key={field.id} className="p-5 bg-brand-sand/30 border-l-4 border-brand-terracotta space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-brand-terracotta uppercase tracking-wider">Editing Field #{field.order}</span>
                    <button onClick={() => setEditingFieldId(null)} className="text-brand-charcoal/60 hover:text-brand-charcoal">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-brand-charcoal/70">Label</label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="w-full bg-white border border-brand-clay rounded-xl p-2 font-bold text-brand-charcoal"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-brand-charcoal/70">Type</label>
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value as any)}
                        className="w-full bg-white border border-brand-clay rounded-xl p-2 font-bold text-brand-charcoal cursor-pointer"
                      >
                        <option value="short_text">Short Text</option>
                        <option value="long_text">Long Text (Textarea)</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="dropdown">Select Dropdown</option>
                        <option value="multi_select">Multi-Select Chips</option>
                        <option value="customer">Customer Selector</option>
                        <option value="staff">Staff Selector</option>
                        <option value="workshop">Workshop Selector</option>
                        <option value="status">Status Selector</option>
                        <option value="piece_code">Piece Code</option>
                        <option value="image">Photo Capture & Preview</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-brand-charcoal/70">Placeholder</label>
                      <input
                        type="text"
                        value={editPlaceholder}
                        onChange={e => setEditPlaceholder(e.target.value)}
                        className="w-full bg-white border border-brand-clay rounded-xl p-2 font-bold text-brand-charcoal"
                      />
                    </div>
                  </div>

                  {/* Dropdown Options Editor */}
                  {(editType === 'dropdown' || editType === 'multi_select') && (
                    <div className="space-y-2 text-xs bg-white p-3 rounded-2xl border border-brand-clay/60">
                      <label className="font-bold text-brand-charcoal/80 block">Configure Options</label>
                      
                      <div className="flex flex-wrap gap-2">
                        {editOptions.map((opt, oIdx) => (
                          <span key={oIdx} className="bg-brand-sand/60 text-brand-charcoal font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border border-brand-clay/40">
                            <span>{opt}</span>
                            <button
                              type="button"
                              onClick={() => setEditOptions(editOptions.filter((_, i) => i !== oIdx))}
                              className="text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add new option..."
                          value={newOptionInput}
                          onChange={e => setNewOptionInput(e.target.value)}
                          className="bg-brand-cream border border-brand-clay rounded-xl px-3 py-1.5 font-bold text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newOptionInput.trim()) {
                              setEditOptions([...editOptions, newOptionInput.trim()]);
                              setNewOptionInput('');
                            }
                          }}
                          className="bg-brand-charcoal text-brand-cream text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-brand-charcoal/90 cursor-pointer"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editRequired}
                          onChange={e => setEditRequired(e.target.checked)}
                          className="rounded border-brand-clay text-brand-terracotta"
                        />
                        <span>Required</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEnabled}
                          onChange={e => setEditEnabled(e.target.checked)}
                          className="rounded border-brand-clay text-brand-terracotta"
                        />
                        <span>Enabled</span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingFieldId(null)}
                        className="px-3 py-1.5 bg-white border border-brand-clay text-brand-charcoal font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-1.5 bg-brand-terracotta text-brand-cream font-bold rounded-xl text-xs hover:bg-brand-terracotta-hover cursor-pointer"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={field.id} className={`p-4 hover:bg-brand-sand/20 transition-colors flex items-center justify-between gap-4 ${!field.enabled ? 'opacity-50 bg-gray-50' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  {/* Move controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveField(idx, 'up')}
                      className="p-1 text-brand-charcoal/40 hover:text-brand-charcoal disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={idx === loggingFields.length - 1}
                      onClick={() => handleMoveField(idx, 'down')}
                      className="p-1 text-brand-charcoal/40 hover:text-brand-charcoal disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <span className="font-mono text-xs font-bold text-brand-charcoal/40 w-6">#{idx + 1}</span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-brand-charcoal truncate">{field.label}</h4>
                      <span className="bg-brand-sand/60 text-brand-charcoal/70 text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase">
                        {field.type}
                      </span>
                      {field.required ? (
                        <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-[9px] font-semibold px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    {field.placeholder && (
                      <p className="text-xs text-brand-charcoal/50 italic truncate mt-0.5">
                        Placeholder: "{field.placeholder}"
                      </p>
                    )}
                    {field.options && field.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {field.options.map((opt, oIdx) => (
                          <span key={oIdx} className="bg-brand-cream border border-brand-clay/40 text-brand-charcoal/70 text-[10px] font-medium px-2 py-0.5 rounded-md">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleRequired(field)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      field.required ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                    title="Toggle Required"
                  >
                    {field.required ? 'Req' : 'Opt'}
                  </button>

                  <button
                    onClick={() => handleToggleEnabled(field)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      field.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                    title={field.enabled ? 'Disable field' : 'Enable field'}
                  >
                    {field.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => handleStartEdit(field)}
                    className="p-1.5 rounded-lg bg-brand-sand/50 text-brand-charcoal hover:bg-brand-sand border border-brand-clay/40 cursor-pointer"
                    title="Edit Field"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setDeleteTargetId(field.id)}
                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 cursor-pointer"
                    title="Delete Field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-brand-charcoal/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-sm w-full text-left space-y-4">
            <h3 className="font-display font-bold text-base text-brand-charcoal flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <span>Remove Console Field?</span>
            </h3>
            <p className="text-xs text-brand-charcoal/70">
              Are you sure you want to remove this field from the Pottery Logging Console? Historical piece data logged using this field will not be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-brand-sand/60 text-brand-charcoal font-bold rounded-xl text-xs hover:bg-brand-sand cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteField(deleteTargetId)}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 cursor-pointer"
              >
                Delete Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
