import { supabase } from '../supabase';

const GUEST_UID = '00000000-0000-0000-0000-000000000000';

export class DBService {
  private isGuest(uid: string) {
    return uid === GUEST_UID || uid?.startsWith('admin-');
  }

  private generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private getLocalData<T>(table: string): T[] {
    const data = localStorage.getItem(`deliciarte_${table}`);
    return data ? JSON.parse(data) : [];
  }

  private setLocalData<T>(table: string, data: T[]) {
    localStorage.setItem(`deliciarte_${table}`, JSON.stringify(data));
    // Trigger storage event for local subscription
    // Custom event to ensure same-window listeners are triggered
    window.dispatchEvent(new CustomEvent('deliciarte_storage', { detail: { table } }));
    // Also dispatch native storage event for cross-tab (though it won't trigger in same window)
    window.dispatchEvent(new Event('storage'));
  }

  async list<T>(table: string, uid: string): Promise<T[]> {
    if (this.isGuest(uid)) {
      return this.getLocalData<T>(table);
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('uid', uid);
    
    if (error) throw error;
    return data as T[];
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    // Try local storage first if it's a guest/admin context
    const localData = this.getLocalData<any>(table);
    const localItem = localData.find((item: any) => item.id === id);
    if (localItem) return localItem as T;

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as T;
  }

  async getSingleByUid<T>(table: string, uid: string): Promise<T | null> {
    if (this.isGuest(uid)) {
      const data = this.getLocalData<any>(table);
      return data[0] || null;
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as T;
  }

  async create<T>(table: string, data: any): Promise<T> {
    console.log(`dbService.create: table=${table}, uid=${data.uid}`, data);
    if (this.isGuest(data.uid)) {
      const localData = this.getLocalData<any>(table);
      const newItem = { 
        ...data, 
        id: data.id || this.generateId(), 
        created_at: data.created_at || new Date().toISOString() 
      };
      localData.push(newItem);
      this.setLocalData(table, localData);
      console.log(`dbService.create: Item salvo localmente`, newItem);
      return newItem as T;
    }

    const { data: created, error } = await supabase
      .from(table)
      .insert([data])
      .select()
      .single();
    
    if (error) {
      console.error(`dbService.create: Erro no Supabase`, error);
      throw error;
    }
    console.log(`dbService.create: Item salvo no Supabase`, created);
    return created as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    console.log(`dbService.update: table=${table}, id=${id}`, data);
    if (this.isGuest(data.uid)) {
      const localData = this.getLocalData<any>(table);
      const index = localData.findIndex((item: any) => item.id === id);
      if (index === -1) {
        console.warn(`dbService.update: Item não encontrado localmente`, id);
        throw new Error('Item not found');
      }
      
      const updatedItem = { ...localData[index], ...data };
      localData[index] = updatedItem;
      this.setLocalData(table, localData);
      console.log(`dbService.update: Item atualizado localmente`, updatedItem);
      return updatedItem as T;
    }

    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error(`dbService.update: Erro no Supabase`, error);
      throw error;
    }
    console.log(`dbService.update: Item atualizado no Supabase`, updated);
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    // For delete, we don't always have the uid in the args, 
    // but we can check if it exists in localStorage first
    const localData = this.getLocalData<any>(table);
    const index = localData.findIndex((item: any) => item.id === id);
    
    if (index !== -1) {
      localData.splice(index, 1);
      this.setLocalData(table, localData);
      return;
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async deleteAllByUid(table: string, uid: string): Promise<void> {
    if (this.isGuest(uid)) {
      this.setLocalData(table, []);
      return;
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('uid', uid);
    
    if (error) throw error;
  }

  subscribe<T>(table: string, uid: string, callback: (data: T[]) => void) {
    if (this.isGuest(uid)) {
      // Initial fetch
      callback(this.getLocalData<T>(table));

      // Listen for local changes
      const handleStorage = (e: Event) => {
        // If it's our custom event, check the table
        if (e instanceof CustomEvent && e.type === 'deliciarte_storage') {
          if (e.detail.table === table) {
            callback(this.getLocalData<T>(table));
          }
        } else {
          // Native storage event (from other tabs)
          callback(this.getLocalData<T>(table));
        }
      };
      window.addEventListener('storage', handleStorage);
      window.addEventListener('deliciarte_storage', handleStorage);
      
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('deliciarte_storage', handleStorage);
      };
    }

    // Fetch initial data
    this.list<T>(table, uid).then(callback).catch(console.error);

    const channel = supabase
      .channel(`public:${table}:uid=eq.${uid}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table, filter: `uid=eq.${uid}` }, 
        async () => {
          const data = await this.list<T>(table, uid);
          callback(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const dbService = new DBService();
