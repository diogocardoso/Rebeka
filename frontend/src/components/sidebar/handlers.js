import { getState, patchState, scheduleSave } from '../../core/store.js';
import { Register } from '../../core/register.js';
import { RequestForm, RenameForm } from './forms.js';
export class Handlers extends Register {
  handlers() {
    APP.fn('addRequest',(Collection)=>{
        const Form = new RequestForm(WA.hp.json_decode(Collection));

        Form.show();
    });

    APP.fn('editSidebar', (item) => {
        const Form = new RenameForm(WA.hp.json_decode(item));

        Form.show();
    });

    APP.fn('confirmDeleteSidebar', (item) => {
        const collection = WA.hp.json_decode(item);
    
        APP.box_confirm('boxDeleteSidebar', {          
          title: 'Excluir coleção',
          content: `Tem certeza que deseja excluir esta coleção (${collection.name})?`,
          action: `deleteSidebar('${collection.id}');`
        });
    });
    
    APP.fn('deleteSidebar', (id) => {
        APP.data.tree.remove(id);
        patchState((s) => {
          const tree = s.tree.filter((n) => n.id !== id);
          APP.box_closed('boxDeleteSidebar');
          return { ...s, tree };
        });
        scheduleSave();
    });

    APP.fn('confirmDeleteWorkspace', () => {
        APP.box_confirm('boxDeleteWorkspace', {
          title: 'Excluir workspace',
          content: 'Tem certeza que deseja excluir este workspace, e todos os dados relacionados a ele?',
          action: 'deleteWorkspace();'
        });
    });

    APP.fn('deleteWorkspace', async () => {
        const id = getState().uiState.activeWorkspaceId;
        if (!id) {
          APP.box_closed('boxDeleteWorkspace');
          return;
        }
        try {
          await APP.components.workspace.delete(id);
          APP.box_closed('boxDeleteWorkspace');
        } catch (e) {
          console.error('Delete workspace failed:', e);
          APP.toast?.('Falha ao excluir workspace', { type: 'error' });
        }
    });
  }    
}