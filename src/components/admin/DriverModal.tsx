import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Bike, User, Phone, Lock, CheckCircle2 } from 'lucide-react';
import { Driver, CreateDriverDTO, UpdateDriverDTO } from '../../types';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverToEdit?: Driver | null;
  onCreate: (data: CreateDriverDTO) => Promise<void>;
  onUpdate: (id: string, data: UpdateDriverDTO) => Promise<void>;
}

export const DriverModal: React.FC<DriverModalProps> = ({
  isOpen,
  onClose,
  driverToEdit,
  onCreate,
  onUpdate
}) => {
  const isEditing = Boolean(driverToEdit);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('Scooter Honda 125cc');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (driverToEdit) {
      setName(driverToEdit.name || '');
      setPhone(driverToEdit.phone || '');
      setVehicle(driverToEdit.vehicle || 'Scooter Honda 125cc');
      setUsername(driverToEdit.username || '');
      setPassword('');
      setActive(driverToEdit.active !== false);
    } else {
      setName('');
      setPhone('+216 ');
      setVehicle('Scooter Honda 125cc');
      setUsername('');
      setPassword('');
      setActive(true);
    }
    setError(null);
  }, [driverToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom complet du livreur est obligatoire.');
      return;
    }
    if (!phone.trim() || phone.trim() === '+216') {
      setError('Le numéro de téléphone du livreur est obligatoire.');
      return;
    }
    if (!vehicle.trim()) {
      setError('Le véhicule du livreur est obligatoire.');
      return;
    }

    if (!isEditing) {
      if (!username.trim()) {
        setError('Le nom d’utilisateur (identifiant de connexion) est obligatoire.');
        return;
      }
      if (username.trim().length < 3) {
        setError('Le nom d’utilisateur doit contenir au moins 3 caractères.');
        return;
      }
      if (!password || password.length < 4) {
        setError('Le mot de passe initial doit contenir au moins 4 caractères.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (isEditing && driverToEdit) {
        await onUpdate(driverToEdit.id, {
          name: name.trim(),
          phone: phone.trim(),
          vehicle: vehicle.trim()
        });
      } else {
        await onCreate({
          name: name.trim(),
          phone: phone.trim(),
          vehicle: vehicle.trim(),
          username: username.trim().toLowerCase(),
          password,
          active
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="driver-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="driver-modal-container"
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          id="driver-modal-close-btn"
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">
              {isEditing ? 'Modifier le livreur' : 'Inscrire un nouveau livreur'}
            </h2>
            <p className="text-xs text-stone-500">
              {isEditing
                ? 'Mise à jour des coordonnées et informations professionnelles'
                : 'Création conjointe de la fiche livreur et de son compte de connexion'}
            </p>
          </div>
        </div>

        {error && (
          <div
            id="driver-modal-error"
            className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
              Informations du livreur
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nom et Prénom *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    id="driver-modal-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex. Yassine Ben Amor"
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Téléphone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="driver-modal-phone-input"
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+216 98 123 456"
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Véhicule *
                  </label>
                  <div className="relative">
                    <Bike className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="driver-modal-vehicle-input"
                      type="text"
                      required
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      placeholder="ex. Scooter Honda 125cc"
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
              Compte de connexion
            </h3>
            {isEditing ? (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Identifiant associé :</span>
                  <span className="font-bold text-stone-800 font-mono">
                    {username || 'Aucun compte associé'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Rôle :</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Livreur
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-2">
                  Pour modifier le mot de passe de ce livreur, utilisez le bouton « Mot de passe » dans la liste.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nom d’utilisateur (Username) *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="driver-modal-username-input"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ex. livreur4"
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Utilisé pour se connecter à l’espace livreur BEBBA.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mot de passe initial *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="driver-modal-password-input"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 4 caractères"
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Sera haché avec bcrypt avant d’être enregistré en base.
                  </p>
                </div>
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2 pt-1">
              <input
                id="driver-modal-active-checkbox"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="driver-modal-active-checkbox" className="text-xs text-stone-700 font-medium">
                Activer immédiatement ce livreur et son compte de connexion
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              id="driver-modal-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Annuler
            </button>
            <button
              id="driver-modal-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Inscrire le livreur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
