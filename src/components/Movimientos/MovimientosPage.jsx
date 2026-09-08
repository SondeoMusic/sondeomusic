import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { ClienteForm } from "../Clientes/ClientesPage";
import "../menu/Dashboard.css";
import "./MovimientosPage.css";

export default function MovimientosPage() {
  const [alquileres, setAlquileres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");

  async function cargarAlquileres() {
    setLoading(true);
    const { data, error } = await supabase
      .from("alquileres")
      .select(
        `id, fecha_inicio, fecha_fin, estado,
         clientes ( nombre, apellidos, telefono ),
         alquiler_items ( equipo_id, equipos ( codigo, informacion ) )`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setAlquileres(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargarAlquileres();
  }, []);

  async function cambiarEstado(alquiler, nuevoEstado) {
    if (
      (nuevoEstado === "finalizado" || nuevoEstado === "cancelado") &&
      !confirm(`¿${nuevoEstado === "finalizado" ? "Finalizar" : "Cancelar"} este alquiler? Los equipos volverán a estar disponibles.`)
    ) {
      return;
    }

    const { error } = await supabase
      .from("alquileres")
      .update({ estado: nuevoEstado })
      .eq("id", alquiler.id);

    if (error) {
      alert("No se pudo actualizar: " + error.message);
      return;
    }
    cargarAlquileres();
  }

  const alquileresFiltrados = alquileres.filter((a) =>
    filtroEstado ? a.estado === filtroEstado : true
  );

  return (
    <>
      <header className="dashboard-header">
        <div className="header-title">
          <span className="header-eyebrow">MOVIMIENTOS</span>
          <h1>Alquileres</h1>
          <p>Registra y da seguimiento a los alquileres de equipo.</p>
        </div>
        <div className="header-actions">
          <button className="add-button" onClick={() => setShowForm(true)}>
            + Nuevo alquiler
          </button>
        </div>
      </header>

      <div className="dashboard-card filtros-bar">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="reservado">Reservado</option>
          <option value="en_curso">En curso</option>
          <option value="finalizado">Finalizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {showForm && (
        <NuevoAlquilerForm
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            cargarAlquileres();
          }}
        />
      )}

      {loading ? (
        <p>Cargando alquileres...</p>
      ) : (
        <div className="alquileres-lista">
          {alquileresFiltrados.length === 0 && (
            <p className="dashboard-card">No hay alquileres que coincidan.</p>
          )}

          {alquileresFiltrados.map((a) => (
            <div className="dashboard-card alquiler-item" key={a.id}>
              <div className="alquiler-header">
                <div>
                  <strong>{a.clientes?.nombre} {a.clientes?.apellidos}</strong>
                  <span> · {a.clientes?.telefono}</span>
                </div>
                <span className={`estado-alquiler estado-${a.estado}`}>{a.estado}</span>
              </div>

              <div className="alquiler-fechas">
                {a.fecha_inicio} → {a.fecha_fin}
              </div>

              <div className="alquiler-equipos">
                {a.alquiler_items.map((item) => (
                  <span className="equipo-chip" key={item.equipo_id}>
                    {item.equipos?.codigo}
                  </span>
                ))}
              </div>

              {(a.estado === "reservado" || a.estado === "en_curso") && (
                <div className="alquiler-acciones">
                  {a.estado === "reservado" && (
                    <button onClick={() => cambiarEstado(a, "en_curso")}>Marcar en curso</button>
                  )}
                  <button onClick={() => cambiarEstado(a, "finalizado")}>Finalizar</button>
                  <button className="alquiler-cancelar" onClick={() => cambiarEstado(a, "cancelado")}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NuevoAlquilerForm({ onCancel, onSaved }) {
  const [clientes, setClientes] = useState([]);
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [equiposSeleccionados, setEquiposSeleccionados] = useState([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [busquedaEquipo, setBusquedaEquipo] = useState("");
  const [filtroCategoriaEquipo, setFiltroCategoriaEquipo] = useState("");

  async function cargarDatos() {
    const [{ data: clientesData }, { data: equiposData }, { data: categoriasData }] = await Promise.all([
      supabase.from("clientes").select("*").order("nombre"),
      supabase
        .from("equipos")
        .select("id, codigo, informacion, categoria_id")
        .eq("disponibilidad", "disponible")
        .order("codigo"),
      supabase.from("categorias").select("id, nombre").order("nombre"),
    ]);
    setClientes(clientesData ?? []);
    setEquiposDisponibles(equiposData ?? []);
    setCategorias(categoriasData ?? []);
  }
  const equiposFiltrados = equiposDisponibles.filter((eq) => {
    if (filtroCategoriaEquipo && String(eq.categoria_id) !== filtroCategoriaEquipo) return false;
    if (busquedaEquipo) {
      const texto = `${eq.codigo} ${eq.informacion ?? ""}`.toLowerCase();
      if (!texto.includes(busquedaEquipo.toLowerCase())) return false;
    }
    return true;
  });
  useEffect(() => {
    cargarDatos();
  }, []);

  function toggleEquipo(id) {
    setEquiposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clienteId) {
      alert("Selecciona un cliente.");
      return;
    }
    if (equiposSeleccionados.length === 0) {
      alert("Selecciona al menos un equipo.");
      return;
    }
    if (!fechaInicio || !fechaFin) {
      alert("Completa las fechas de inicio y fin.");
      return;
    }
    if (fechaFin < fechaInicio) {
      alert("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    setGuardando(true);

    const { data: alquiler, error } = await supabase
      .from("alquileres")
      .insert({
        cliente_id: clienteId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      })
      .select()
      .single();

    if (error) {
      alert("No se pudo crear el alquiler: " + error.message);
      setGuardando(false);
      return;
    }

    const items = equiposSeleccionados.map((equipo_id) => ({
      alquiler_id: alquiler.id,
      equipo_id,
    }));

    const { error: errorItems } = await supabase.from("alquiler_items").insert(items);

    setGuardando(false);

    if (errorItems) {
      alert("El alquiler se creó, pero hubo un error asignando equipos: " + errorItems.message);
      return;
    }
    onSaved();
  }

  return (
    <form className="dashboard-card alquiler-form" onSubmit={handleSubmit}>
      <h2>Nuevo alquiler</h2>

      <div className="alquiler-form-grid">
        <label>
          Cliente
          <div className="cliente-select-row">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
              <option value="">Selecciona...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} {c.apellidos}</option>
              ))}
            </select>
            <button type="button" onClick={() => setMostrarNuevoCliente(true)}>
              + Nuevo
            </button>
          </div>
        </label>

        <label>
          Fecha de inicio
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
        </label>

        <label>
          Fecha de fin
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
        </label>
      </div>

      {mostrarNuevoCliente && (
        <ClienteForm
          initialCliente={null}
          onCancel={() => setMostrarNuevoCliente(false)}
          onSaved={(nuevoCliente) => {
            setMostrarNuevoCliente(false);
            setClientes((prev) => [...prev, nuevoCliente]);
            setClienteId(nuevoCliente.id);
          }}
        />
      )}

      <h3>Equipos disponibles</h3>
      <div className="equipos-filtros">
        <input
          type="text"
          placeholder="Buscar por código o información..."
          value={busquedaEquipo}
          onChange={(e) => setBusquedaEquipo(e.target.value)}
        />
        <select
          value={filtroCategoriaEquipo}
          onChange={(e) => setFiltroCategoriaEquipo(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div className="equipos-checklist">
        {equiposDisponibles.length === 0 && <p>No hay equipos disponibles en este momento.</p>}
        {equiposFiltrados.map((eq) => (
          <label key={eq.id} className="equipo-checkbox">
            <input
              type="checkbox"
              checked={equiposSeleccionados.includes(eq.id)}
              onChange={() => toggleEquipo(eq.id)}
            />
            <span>{eq.codigo} — {eq.informacion || "sin descripción"}</span>
          </label>
        ))}
      </div>

      <div className="equipo-form-acciones">
        <button type="button" onClick={onCancel} disabled={guardando}>Cancelar</button>
        <button type="submit" className="add-button" disabled={guardando}>
          {guardando ? "Guardando..." : "Crear alquiler"}
        </button>
      </div>
    </form>
  );
}